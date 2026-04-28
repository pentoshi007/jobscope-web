import type { NextRequest } from "next/server";
import { after } from "next/server";
import { errorToLog, logAppEvent } from "@/lib/app-log";
import { connectMongoose, getDb } from "@/lib/db";
import { buildPersonalizedQuery } from "@/lib/jobs/personalized";
import { jobMatchesProfile } from "@/lib/jobs/profile";
import { score } from "@/lib/match/score";
import { parsePrefs } from "@/lib/preferences";
import { getSession } from "@/lib/session";
import { Job, type JobDoc } from "@/models/job";
import { Resume } from "@/models/resume";

export const runtime = "nodejs";
export const maxDuration = 30;

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

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = session.user.id;

  await connectMongoose();
  const resumes = await Resume.find({ userId, isActive: true, deletedAt: null })
    .select({ parsed: 1 })
    .lean();
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

        // Score only cached jobs. Fresh external API fetches happen on resume upload and cron.
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const filter: Record<string, unknown> = { fetchedAt: { $gte: since } };

        const cached = await Job.find(filter)
          .sort({ postedAt: -1 })
          .limit(1000)
          .select({
            title: 1,
            company: 1,
            location: 1,
            remote: 1,
            seniority: 1,
            source: 1,
            url: 1,
            postedAt: 1,
            salary: 1,
            description: 1,
            category: 1,
            tags: 1,
            extractedSkills: 1,
          })
          .lean();

        safeSend("status", { phase: "scoring", count: cached.length });

        const seenIds = new Set<string>();
        const scored = cached
          .filter((j) => jobMatchesProfile(pq.profile, j))
          .map((j) => {
            const matches = resumes.map((r) =>
              score(r.parsed as never, j as never, {
                preferredLocations: prefs.preferredLocations,
                roleProfile: pq.profile,
              }),
            );
            return { j, m: matches.reduce((a, b) => (a.score >= b.score ? a : b)) };
          })
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
          await new Promise((r) => setTimeout(r, 20));
        }

        safeSend("done", { fetched: 0 });
      } catch (e) {
        const details = errorToLog(e);
        after(() =>
          logAppEvent({
            kind: "api",
            source: "api.jobs.refresh",
            path: "/api/jobs/refresh",
            userId,
            message: details.message,
            stack: details.stack,
          }),
        );
        safeSend("status", {
          phase: "error",
          message: details.message || "stream failed",
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
