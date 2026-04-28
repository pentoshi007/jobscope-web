import { after, type NextRequest, NextResponse } from "next/server";
import { errorToLog, logAppEvent } from "@/lib/app-log";
import { connectMongoose, getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { ADAPTERS } from "@/lib/jobs/adapters";
import { dedupeHash } from "@/lib/jobs/dedupe";
import { llmSkillExtract, quickSkillExtract } from "@/lib/jobs/enrich";
import { buildPersonalizedQuery, fetchAndStorePersonalizedJobs } from "@/lib/jobs/personalized";
import { Job } from "@/models/job";
import { Resume } from "@/models/resume";
// revalidation handled by cache components TTL

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }
  return runFetch();
}

export async function POST(req: NextRequest) {
  return GET(req);
}

async function runFetch() {
  await connectMongoose();
  const summary: Record<string, { fetched: number; upserted: number; error?: string }> = {};

  await Promise.allSettled(
    ADAPTERS.map(async (adapter) => {
      const stat = { fetched: 0, upserted: 0 } as {
        fetched: number;
        upserted: number;
        error?: string;
      };
      try {
        const raw = await adapter.fetch();
        stat.fetched = raw.length;
        const ops = raw
          .map((r) => adapter.normalize(r))
          .filter((j): j is NonNullable<ReturnType<typeof adapter.normalize>> => !!j)
          .map((j) => {
            const skills = quickSkillExtract(`${j.title} ${j.description}`);
            return {
              updateOne: {
                filter: { externalId: j.externalId, source: j.source },
                update: {
                  $set: {
                    ...j,
                    dedupeHash: dedupeHash(j.title, j.company, j.location),
                    extractedSkills: skills,
                    fetchedAt: new Date(),
                  },
                },
                upsert: true,
              },
            };
          });
        if (ops.length) {
          const res = await Job.bulkWrite(ops as never, { ordered: false });
          stat.upserted = (res.upsertedCount ?? 0) + (res.modifiedCount ?? 0);
        }
      } catch (e) {
        stat.error = e instanceof Error ? e.message : "unknown";
        const details = errorToLog(e);
        after(() =>
          logAppEvent({
            kind: "cron",
            source: `cron.fetch-jobs.${adapter.source}`,
            path: "/api/cron/fetch-jobs",
            message: details.message,
            stack: details.stack,
          }),
        );
      }
      summary[adapter.source] = stat;
    }),
  );

  try {
    const db = getDb();
    const activeResumes = await Resume.find({ isActive: true, deletedAt: null })
      .sort({ updatedAt: -1 })
      .limit(50)
      .select({ userId: 1, parsed: 1 })
      .lean();
    const users = await db
      .collection("user")
      .find(
        { id: { $in: activeResumes.map((resume) => resume.userId) } },
        { projection: { id: 1, preferences: 1 } },
      )
      .toArray();
    const prefsByUser = new Map(
      users.map((user) => [String(user.id), safePreferredLocations(user.preferences)]),
    );

    let personalizedFetched = 0;
    let personalizedUpserted = 0;
    for (const resume of activeResumes) {
      const query = buildPersonalizedQuery(
        [resume.parsed as never],
        prefsByUser.get(resume.userId) ?? [],
      );
      const personalized = await fetchAndStorePersonalizedJobs(query, { allowAdzuna: false });
      for (const stat of Object.values(personalized)) {
        personalizedFetched += stat.fetched;
        personalizedUpserted += stat.upserted;
      }
    }
    summary.personalized = { fetched: personalizedFetched, upserted: personalizedUpserted };
  } catch (e) {
    const details = errorToLog(e);
    summary.personalized = { fetched: 0, upserted: 0, error: details.message };
    after(() =>
      logAppEvent({
        kind: "cron",
        source: "cron.fetch-jobs.personalized",
        path: "/api/cron/fetch-jobs",
        message: details.message,
        stack: details.stack,
      }),
    );
  }

  try {
    const stale = await Job.find({ extractedSkills: { $size: 0 } })
      .sort({ postedAt: -1 })
      .limit(40)
      .select({ _id: 1, title: 1, description: 1 })
      .lean();
    if (stale.length) {
      const enriched = await llmSkillExtract(
        stale.map((j) => ({ title: j.title, description: j.description ?? "" })),
      );
      await Promise.all(
        stale.map((j, i) =>
          Job.updateOne({ _id: j._id }, { $set: { extractedSkills: enriched[i] ?? [] } }),
        ),
      );
    }
  } catch (e) {
    const details = errorToLog(e);
    after(() =>
      logAppEvent({
        kind: "cron",
        source: "cron.fetch-jobs.enrichment",
        path: "/api/cron/fetch-jobs",
        message: details.message,
        stack: details.stack,
      }),
    );
  }

  const successfulFetch = Object.values(summary).some((s) => s.fetched > 0 && !s.error);
  let deletedOld = 0;
  if (successfulFetch) {
    const res = await Job.deleteMany({
      fetchedAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });
    deletedOld = res.deletedCount ?? 0;
  }

  return NextResponse.json({ ok: true, data: { summary, deletedOld } });
}

function safePreferredLocations(raw: unknown) {
  try {
    const prefs = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(prefs?.preferredLocations) ? prefs.preferredLocations : [];
  } catch {
    return [];
  }
}
