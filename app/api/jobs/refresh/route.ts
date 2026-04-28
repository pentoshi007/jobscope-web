import type { NextRequest } from "next/server";
import { connectMongoose, getDb } from "@/lib/db";
import {
  buildPersonalizedQuery,
  enrichForUpsert,
  streamPersonalizedJobs,
} from "@/lib/jobs/personalized";
import { score } from "@/lib/match/score";
import { parsePrefs } from "@/lib/preferences";
import { rateLimit } from "@/lib/rate-limit";
import { getSession } from "@/lib/session";
import { Job, type JobDoc } from "@/models/job";
import { Resume } from "@/models/resume";

export const runtime = "nodejs";
export const maxDuration = 60;

type SsePayload = Record<string, unknown>;

function sse(controller: ReadableStreamDefaultController, event: string, data: SsePayload) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  controller.enqueue(new TextEncoder().encode(msg));
}

function jobToWire(job: JobDoc, m: ReturnType<typeof score>) {
  return {
    id: String(job._id),
    title: job.title,
    company: job.company,
    location: job.location ?? "",
    remote: !!job.remote,
    seniority: job.seniority,
    source: job.source,
    url: job.url,
    postedAt:
      job.postedAt instanceof Date
        ? job.postedAt.toISOString()
        : new Date(job.postedAt).toISOString(),
    salary: job.salary
      ? {
          min: job.salary.min ?? null,
          max: job.salary.max ?? null,
          currency: job.salary.currency ?? null,
          period: job.salary.period ?? null,
        }
      : null,
    match: {
      score: m.score,
      matchedSkills: m.matchedSkills.slice(0, 8),
      missingSkills: m.missingSkills.slice(0, 5),
    },
  };
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = session.user.id;

  await connectMongoose();
  const resumes = await Resume.find({ userId, isActive: true, deletedAt: null }).lean();
  if (resumes.length === 0) {
    return new Response("No active resume", { status: 400 });
  }

  const db = getDb();
  const userRow = (await db
    .collection("user")
    .findOne({ id: userId }, { projection: { preferences: 1 } })) as {
    preferences?: string;
  } | null;
  const prefs = parsePrefs(userRow?.preferences);

  // Per-user cooldown: 1 fresh fetch every 30 min keeps API quotas safe.
  const fresh = rateLimit(`refresh:${userId}`, 1, 30 * 60 * 1000);
  // Adzuna costs scarce credits — gate it tighter (1 / 6h per user).
  const allowAdzuna = rateLimit(`refresh-adzuna:${userId}`, 1, 6 * 60 * 60 * 1000).ok;

  const pq = buildPersonalizedQuery(
    resumes.map((r) => r.parsed as never),
    prefs.preferredLocations,
  );

  const stream = new ReadableStream({
    async start(controller) {
      const closed = { value: false };
      const safeSend = (event: string, data: SsePayload) => {
        if (closed.value) return;
        try {
          sse(controller, event, data);
        } catch {
          closed.value = true;
        }
      };

      try {
        safeSend("status", {
          phase: "starting",
          query: { keywords: pq.keywords, role: pq.primaryRole },
        });

        // PHASE 1 — score the cached DB and stream the top matches.
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const filter: Record<string, unknown> = { postedAt: { $gte: since } };
        const candidateSkills = pq.keywords.map((k) => k.toLowerCase());
        if (candidateSkills.length) filter.extractedSkills = { $in: candidateSkills };

        const cached = await Job.find(filter).sort({ postedAt: -1 }).limit(400).lean();
        safeSend("status", { phase: "scoring", count: cached.length });

        const seenIds = new Set<string>();
        const scored = cached
          .map((j) => ({
            j,
            m: score(resumes[0].parsed as never, j as never, {
              preferredLocations: prefs.preferredLocations,
            }),
          }))
          .filter(({ m }) => m.score >= 30)
          .sort((a, b) => b.m.score - a.m.score)
          .slice(0, 60);

        const BATCH = 8;
        for (let i = 0; i < scored.length; i += BATCH) {
          if (closed.value) return;
          const batch = scored.slice(i, i + BATCH).map(({ j, m }) => {
            seenIds.add(String(j._id));
            return jobToWire(j as never, m);
          });
          safeSend("jobs", { jobs: batch, source: "cached" });
          await new Promise((r) => setTimeout(r, 50));
        }

        if (!fresh.ok) {
          safeSend("status", {
            phase: "cooldown",
            message: "Fresh sources cooling down. Showing cached matches.",
          });
          safeSend("done", { fetched: 0 });
          controller.close();
          closed.value = true;
          return;
        }

        // PHASE 2 — pull fresh personalized jobs and stream as each source returns.
        safeSend("status", { phase: "fetching" });
        let totalFetched = 0;
        for await (const batch of streamPersonalizedJobs(pq, { allowAdzuna })) {
          if (closed.value) return;
          if (batch.error) {
            safeSend("status", { phase: "source-error", source: batch.source, error: batch.error });
            continue;
          }
          if (batch.jobs.length === 0) {
            safeSend("status", { phase: "source-empty", source: batch.source });
            continue;
          }

          const docs = enrichForUpsert(batch.jobs);
          await Job.bulkWrite(
            docs.map((d) => ({
              updateOne: {
                filter: { externalId: d.externalId, source: d.source },
                update: { $set: d },
                upsert: true,
              },
            })) as never,
            { ordered: false },
          ).catch(() => undefined);

          // Re-read so we have _id and the persisted shape.
          const persisted = await Job.find({
            source: batch.source,
            externalId: { $in: docs.map((d) => d.externalId) },
          }).lean();

          const ranked = persisted
            .map((j) => ({
              j,
              m: score(resumes[0].parsed as never, j as never, {
                preferredLocations: prefs.preferredLocations,
              }),
            }))
            .filter(({ j, m }) => m.score >= 30 && !seenIds.has(String(j._id)))
            .sort((a, b) => b.m.score - a.m.score)
            .slice(0, 20);

          for (const { j } of ranked) seenIds.add(String(j._id));
          totalFetched += ranked.length;

          if (ranked.length) {
            safeSend("jobs", {
              jobs: ranked.map(({ j, m }) => jobToWire(j as never, m)),
              source: batch.source,
            });
          }
          safeSend("status", {
            phase: "source-done",
            source: batch.source,
            added: ranked.length,
          });
        }

        safeSend("done", { fetched: totalFetched });
      } catch (e) {
        safeSend("status", {
          phase: "error",
          message: e instanceof Error ? e.message : "stream failed",
        });
        safeSend("done", { fetched: 0 });
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
        closed.value = true;
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
