import { after, type NextRequest, NextResponse } from "next/server";
import { errorToLog, logAppEvent } from "@/lib/app-log";
import { connectMongoose, getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { llmSkillExtract } from "@/lib/jobs/enrich";
import { runIngestSources } from "@/lib/jobs/ingest/runner";
import { buildIngestSources } from "@/lib/jobs/ingest/sources";
import { buildPersonalizedQuery, fetchAndStorePersonalizedJobs } from "@/lib/jobs/personalized";
import { inferCountry } from "@/lib/match/location";
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
  const runStartedAt = Date.now();
  const cronDeadlineAt = runStartedAt + 55_000;
  await connectMongoose();
  const summary: Record<string, { fetched: number; upserted: number; error?: string }> = {};
  const activeResumes = await Resume.find({ isActive: true, deletedAt: null })
    .sort({ updatedAt: -1 })
    .limit(50)
    .select({ userId: 1, parsed: 1 })
    .lean();
  const db = getDb();
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

  const ingest = await runIngestSources(buildIngestSources(), {
    roles: aggregateRoles(activeResumes.map((resume) => resume.parsed as never)),
    countries: aggregateCountries(
      activeResumes.map((resume) => resume.parsed as never),
      [...prefsByUser.values()].flat(),
    ),
    cities: aggregateCities(
      activeResumes.map((resume) => resume.parsed as never),
      [...prefsByUser.values()].flat(),
    ),
    maxDurationMs: 32_000,
    concurrency: 4,
  });
  for (const [source, stat] of Object.entries(ingest)) {
    summary[source] = {
      fetched: stat.fetched,
      upserted: stat.upserted,
      ...(stat.error ? { error: stat.error } : {}),
    };
  }

  try {
    let personalizedFetched = 0;
    let personalizedUpserted = 0;
    for (const resume of activeResumes) {
      if (Date.now() >= cronDeadlineAt) {
        await logAppEvent({
          level: "warn",
          kind: "cron",
          source: "cron.fetch-jobs.personalized",
          path: "/api/cron/fetch-jobs",
          message: "Personalized job fetch stopped because cron deadline was reached",
          meta: { processedFetched: personalizedFetched, processedUpserted: personalizedUpserted },
        });
        break;
      }
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
      $or: [
        { cacheExpiresAt: { $lt: new Date() } },
        {
          cacheExpiresAt: { $exists: false },
          fetchedAt: { $lt: new Date(Date.now() - TWO_DAYS_MS) },
        },
      ],
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

const TWO_DAYS_MS = 48 * 60 * 60 * 1000;

function aggregateRoles(
  resumes: Array<{ jobSearchProfile?: { searchQueries?: string[]; primaryRole?: string } }>,
) {
  return unique(
    resumes.flatMap((resume) => [
      ...(resume.jobSearchProfile?.searchQueries ?? []),
      resume.jobSearchProfile?.primaryRole ?? "",
    ]),
  ).slice(0, 8);
}

function aggregateCountries(resumes: Array<{ location?: string }>, preferredLocations: string[]) {
  return unique(
    [...preferredLocations, ...resumes.map((resume) => resume.location ?? "")]
      .map(inferCountry)
      .filter(Boolean),
  ).slice(0, 6);
}

function aggregateCities(resumes: Array<{ location?: string }>, preferredLocations: string[]) {
  return unique(
    [...preferredLocations, ...resumes.map((resume) => resume.location ?? "")]
      .map((loc) => loc.split(",")[0]?.trim() ?? "")
      .filter(Boolean),
  ).slice(0, 10);
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
