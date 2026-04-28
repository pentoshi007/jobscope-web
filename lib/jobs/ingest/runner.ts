import { errorToLog, logAppEvent } from "@/lib/app-log";
import { dedupeHash } from "@/lib/jobs/dedupe";
import { quickSkillExtract } from "@/lib/jobs/enrich";
import type { NormalizedJob } from "@/lib/jobs/types";
import { inferCountry } from "@/lib/match/location";
import { Job } from "@/models/job";
import { recordSourceHealth } from "../source-health";

export interface IngestContext {
  roles: string[];
  countries: string[];
  cities: string[];
  deadlineAt: number;
}

export interface IngestSource {
  source: string;
  enabled: boolean;
  quality: number;
  maxRunMs: number;
  fetchJobs: (ctx: IngestContext) => Promise<NormalizedJob[]>;
}

export interface SourceRunSummary {
  fetched: number;
  normalized: number;
  upserted: number;
  skipped: number;
  durationMs: number;
  error?: string;
}

export type IngestSummary = Record<string, SourceRunSummary>;

export async function runIngestSources(
  sources: IngestSource[],
  ctx: Omit<IngestContext, "deadlineAt"> & { maxDurationMs: number; concurrency?: number },
) {
  const summary: IngestSummary = {};
  const queue = sources.filter((source) => source.enabled);
  const concurrency = Math.max(1, Math.min(ctx.concurrency ?? 4, 6));
  const globalDeadlineAt = Date.now() + ctx.maxDurationMs;
  let cursor = 0;

  async function worker() {
    while (cursor < queue.length) {
      if (Date.now() >= globalDeadlineAt) return;
      const source = queue[cursor++];
      const deadlineAt = Math.min(Date.now() + source.maxRunMs, globalDeadlineAt);
      summary[source.source] = await runOneSource(source, { ...ctx, deadlineAt });
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()));

  for (const source of queue) {
    if (summary[source.source]) continue;
    const result = {
      fetched: 0,
      normalized: 0,
      upserted: 0,
      skipped: 0,
      durationMs: 0,
      error: "global ingest deadline reached before source could run",
    };
    summary[source.source] = result;
    await recordSourceHealth({
      source: source.source,
      enabled: true,
      failed: 1,
      error: result.error,
    });
  }

  for (const source of sources.filter((source) => !source.enabled)) {
    summary[source.source] = { fetched: 0, normalized: 0, upserted: 0, skipped: 0, durationMs: 0 };
    await recordSourceHealth({ source: source.source, enabled: false });
  }

  return summary;
}

async function runOneSource(source: IngestSource, ctx: IngestContext): Promise<SourceRunSummary> {
  const started = Date.now();
  try {
    if (Date.now() >= ctx.deadlineAt) {
      throw new Error("source skipped because ingest deadline was reached");
    }
    const jobs = await source.fetchJobs(ctx);
    const docs = enrichForUpsert(jobs, source.quality);
    const upserted = await bulkUpsertJobs(docs);
    const result = {
      fetched: jobs.length,
      normalized: docs.length,
      upserted,
      skipped: Math.max(0, jobs.length - docs.length),
      durationMs: Date.now() - started,
    };
    await recordSourceHealth({ source: source.source, enabled: true, ...result });
    return result;
  } catch (error) {
    const details = errorToLog(error);
    const result = {
      fetched: 0,
      normalized: 0,
      upserted: 0,
      skipped: 0,
      durationMs: Date.now() - started,
      error: details.message,
    };
    await recordSourceHealth({
      source: source.source,
      enabled: true,
      failed: 1,
      durationMs: result.durationMs,
      error: details.message,
    });
    await logAppEvent({
      kind: "job_source",
      source: `jobs.${source.source}`,
      path: "/api/cron/fetch-jobs",
      message: details.message,
      stack: details.stack,
      meta: { durationMs: result.durationMs },
    });
    return result;
  }
}

export function enrichForUpsert(jobs: NormalizedJob[], sourceQuality = 50) {
  const now = Date.now();
  return jobs
    .filter((j) => j.externalId && j.source && j.title && j.url)
    .map((j) => {
      const location = j.location ?? "";
      const country = j.country || inferCountry(location);
      const skills = quickSkillExtract(`${j.title} ${j.description}`);
      return {
        ...j,
        country,
        sourceQuality: j.sourceQuality ?? sourceQuality,
        dedupeHash: dedupeHash(j.title, j.company, location, j.url),
        extractedSkills: skills,
        fetchedAt: new Date(now),
        cacheExpiresAt: new Date(now + cacheTtlMs(j.source)),
      };
    });
}

export function cacheTtlMs(source: string) {
  if (source === "indianapi") return 10 * 24 * 60 * 60 * 1000;
  return 48 * 60 * 60 * 1000;
}

export async function bulkUpsertJobs(docs: ReturnType<typeof enrichForUpsert>) {
  let upserted = 0;
  const chunkSize = 400;
  for (let i = 0; i < docs.length; i += chunkSize) {
    const chunk = docs.slice(i, i + chunkSize);
    if (chunk.length === 0) continue;
    const res = await Job.bulkWrite(
      chunk.map((d) => ({
        updateOne: {
          filter: { externalId: d.externalId, source: d.source },
          update: { $set: d },
          upsert: true,
        },
      })) as never,
      { ordered: false },
    );
    upserted += (res.upsertedCount ?? 0) + (res.modifiedCount ?? 0);
  }
  return upserted;
}
