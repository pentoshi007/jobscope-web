import { inferCountry } from "@/lib/match/location";
import type { MatchResult } from "@/lib/match/score";
import { score } from "@/lib/match/score";
import type { ParsedResume } from "@/lib/resume/schema";
import type { ResumeJobProfile } from "./profile";

type RankableJob = {
  title?: string;
  description?: string;
  location?: string | null;
  country?: string | null;
  remote?: boolean | null;
  workMode?: string | null;
  postedAt: Date;
  seniority?: string | null;
  extractedSkills?: string[] | null;
  sourceQuality?: number | null;
  cacheExpiresAt?: Date | null;
};

export interface RankedJob<TJob extends RankableJob> {
  j: TJob;
  m: MatchResult;
  bucket: RankBucket;
  sortScore: number;
}

export type RankBucket = "targetRemote" | "targetOnsite" | "otherRemote" | "otherOnsite";

export interface RankJobsOptions {
  preferredLocations?: string[];
  roleProfile?: ResumeJobProfile;
  minScore?: number;
  targetMinScore?: number;
  limit?: number;
  remoteOnly?: boolean;
  strictCountryRatio?: boolean;
}

export function rankJobsForUser<TJob extends RankableJob>(
  resumes: ParsedResume[],
  jobs: TJob[],
  opts: RankJobsOptions = {},
) {
  const targetCountry = inferTargetCountry(resumes, opts.preferredLocations ?? []);
  const minScore = opts.minScore ?? 30;
  const targetMinScore = opts.targetMinScore ?? Math.max(20, minScore - 10);
  const limit = opts.limit ?? 60;
  const ranked = jobs
    .map((job) => {
      const matches = resumes.map((resume) =>
        score(resume, job as never, {
          preferredLocations: opts.preferredLocations,
          roleProfile: opts.roleProfile,
        }),
      );
      const m = matches.reduce((a, b) => (a.score >= b.score ? a : b));
      return {
        j: job,
        m,
        bucket: bucketFor(job, targetCountry),
        sortScore: m.score + Math.min(10, Math.max(0, (job.sourceQuality ?? 50) / 10)),
      };
    })
    .filter(({ j, m, bucket }) => {
      const requiredScore = bucket.startsWith("target") ? targetMinScore : minScore;
      return m.score >= requiredScore && (!opts.remoteOnly || j.remote);
    });

  return allocateByDistribution(ranked, limit, opts.strictCountryRatio ?? true);
}

export function inferTargetCountry(resumes: ParsedResume[], preferredLocations: string[] = []) {
  for (const loc of preferredLocations) {
    const country = inferCountry(loc);
    if (country) return country;
  }
  for (const resume of resumes) {
    const country = inferCountry(resume.location);
    if (country) return country;
  }
  return "";
}

function bucketFor(job: RankableJob, targetCountry: string): RankBucket {
  const jobCountry = job.country || inferCountry(job.location ?? "");
  const sameCountry = Boolean(targetCountry && jobCountry && jobCountry === targetCountry);
  if (job.remote) return sameCountry ? "targetRemote" : "otherRemote";
  return sameCountry ? "targetOnsite" : "otherOnsite";
}

function allocateByDistribution<TJob extends RankableJob>(
  ranked: Array<RankedJob<TJob>>,
  limit: number,
  strictCountryRatio: boolean,
) {
  const byBucket: Record<RankBucket, Array<RankedJob<TJob>>> = {
    targetRemote: [],
    targetOnsite: [],
    otherRemote: [],
    otherOnsite: [],
  };
  for (const item of ranked) byBucket[item.bucket].push(item);
  for (const bucket of Object.values(byBucket)) {
    bucket.sort((a, b) => b.sortScore - a.sortScore);
  }

  const targetTotal = Math.round(limit * 0.65);
  const quotas: Record<RankBucket, number> = {
    targetRemote: Math.round(targetTotal * 0.6),
    targetOnsite: targetTotal - Math.round(targetTotal * 0.6),
    otherRemote: Math.round(limit * 0.3),
    otherOnsite: Math.max(1, limit - targetTotal - Math.round(limit * 0.3)),
  };

  const selected: Array<RankedJob<TJob>> = [];
  const seen = new Set<TJob>();
  for (const bucket of ["targetRemote", "targetOnsite", "otherRemote", "otherOnsite"] as const) {
    for (const item of byBucket[bucket].slice(0, quotas[bucket])) {
      selected.push(item);
      seen.add(item.j);
    }
  }

  if (selected.length < limit) {
    const targetBackfill = [...byBucket.targetRemote, ...byBucket.targetOnsite]
      .filter((item) => !seen.has(item.j))
      .sort((a, b) => b.sortScore - a.sortScore)
      .slice(0, limit - selected.length);
    for (const item of targetBackfill) {
      selected.push(item);
      seen.add(item.j);
    }
  }

  // If there are any target-country matches, do not let other-country jobs exceed their quota.
  // This may intentionally return fewer jobs instead of showing a feed dominated by other countries.
  if (!strictCountryRatio || selected.every((item) => !item.bucket.startsWith("target"))) {
    const backfill = ranked
      .filter((item) => !seen.has(item.j))
      .sort((a, b) => b.sortScore - a.sortScore)
      .slice(0, limit - selected.length);
    selected.push(...backfill);
  }

  return selected.sort((a, b) => b.sortScore - a.sortScore).slice(0, limit);
}
