import { Job } from "@/models/job";
import { env } from "../env";
import type { ParsedResume } from "../resume/schema";
import { dedupeHash } from "./dedupe";
import { quickSkillExtract } from "./enrich";
import { buildResumeJobProfile, jobMatchesProfile, type ResumeJobProfile } from "./profile";
import { inferSeniority, type NormalizedJob, stripHtml } from "./types";

export interface PersonalizedQuery {
  keywords: string[];
  primaryRole: string;
  seniority: ParsedResume["inferredSeniority"];
  locations: string[];
  profile: ResumeJobProfile;
}

export function buildPersonalizedQuery(
  resumes: ParsedResume[],
  preferredLocations: string[] = [],
): PersonalizedQuery {
  if (resumes.length === 0) {
    return {
      keywords: ["software engineer"],
      primaryRole: "software engineer",
      seniority: "mid",
      locations: preferredLocations,
      profile: buildResumeJobProfile([]),
    };
  }

  const skillCount = new Map<string, number>();
  let seniority: ParsedResume["inferredSeniority"] = "mid";

  for (const r of resumes) {
    seniority = r.inferredSeniority;
    const top = [
      ...r.skills.languages,
      ...r.skills.frameworks,
      ...r.skills.databases,
      ...r.skills.cloud,
      ...r.skills.tools,
    ];
    for (const s of top) {
      const k = s.toLowerCase().trim();
      if (!k) continue;
      skillCount.set(k, (skillCount.get(k) ?? 0) + 1);
    }
  }

  const topSkills = [...skillCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([s]) => s);

  const profile = buildResumeJobProfile(resumes);
  const primaryRole = profile.queryRoles[0] ?? "software engineer";
  const keywords = Array.from(
    new Set([...profile.requiredTerms.slice(0, 4), ...topSkills.slice(0, 3), primaryRole]),
  ).filter(Boolean);

  return { keywords, primaryRole, seniority, locations: preferredLocations, profile };
}

interface JoobleJobRaw {
  id: number;
  title: string;
  company: string;
  location: string;
  snippet: string;
  link: string;
  updated: string;
}

interface AdzunaJobRaw {
  id: string;
  title: string;
  company: { display_name: string };
  location: { display_name: string };
  description: string;
  redirect_url: string;
  created: string;
  salary_min?: number;
  salary_max?: number;
  category?: { label: string };
}

interface RemotiveJobRaw {
  id: number;
  url: string;
  title: string;
  company_name: string;
  category: string;
  publication_date: string;
  candidate_required_location: string;
  description: string;
  tags: string[];
}

async function fetchJoobleKeyword(query: PersonalizedQuery): Promise<NormalizedJob[]> {
  if (!env.JOOBLE_API_KEY) return [];
  const keywords = query.keywords.join(" ");
  const location = query.locations[0] ?? "";
  try {
    const r = await fetch(`https://jooble.org/api/${env.JOOBLE_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords, location, page: 1 }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return [];
    const j = (await r.json()) as { jobs?: JoobleJobRaw[] };
    return (j.jobs ?? [])
      .filter((x) => x.id && x.title && x.link)
      .map<NormalizedJob>((x) => ({
        externalId: String(x.id),
        source: "jooble",
        title: x.title,
        company: x.company || "Unknown",
        location: x.location ?? "",
        remote: /remote/i.test(x.location ?? "") || /remote/i.test(x.title),
        workMode: /remote/i.test(x.location ?? "") ? "remote" : "onsite",
        description: stripHtml(x.snippet ?? ""),
        url: x.link,
        postedAt: x.updated ? new Date(x.updated) : new Date(),
        salary: { min: null, max: null, currency: null, period: null },
        category: "",
        tags: [],
        seniority: inferSeniority(x.title),
      }))
      .filter((job) => jobMatchesProfile(query.profile, job));
  } catch {
    return [];
  }
}

async function fetchAdzunaKeyword(query: PersonalizedQuery): Promise<NormalizedJob[]> {
  if (!env.ADZUNA_APP_ID || !env.ADZUNA_APP_KEY) return [];
  const what = encodeURIComponent(query.keywords.join(" "));
  const country = guessAdzunaCountry(query.locations[0] ?? "");
  const ccy = country === "in" ? "INR" : country === "gb" ? "GBP" : "USD";
  try {
    const r = await fetch(
      `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${env.ADZUNA_APP_ID}&app_key=${env.ADZUNA_APP_KEY}&results_per_page=30&what=${what}`,
      { signal: AbortSignal.timeout(15000) },
    );
    if (!r.ok) return [];
    const j = (await r.json()) as { results?: AdzunaJobRaw[] };
    return (j.results ?? [])
      .filter((x) => x.id && x.title && x.redirect_url)
      .map<NormalizedJob>((x) => {
        const loc = x.location?.display_name ?? "";
        const remote = /remote/i.test(loc) || /remote/i.test(x.title);
        return {
          externalId: `${country}-${x.id}`,
          source: "adzuna",
          title: x.title,
          company: x.company?.display_name ?? "",
          location: loc,
          remote,
          workMode: remote ? "remote" : "onsite",
          description: stripHtml(x.description ?? ""),
          url: x.redirect_url,
          postedAt: new Date(x.created),
          salary: {
            min: x.salary_min ?? null,
            max: x.salary_max ?? null,
            currency: x.salary_min || x.salary_max ? ccy : null,
            period: "year",
          },
          category: x.category?.label ?? "",
          tags: [],
          seniority: inferSeniority(x.title),
        };
      })
      .filter((job) => jobMatchesProfile(query.profile, job));
  } catch {
    return [];
  }
}

function guessAdzunaCountry(loc: string): "in" | "gb" | "us" {
  const l = loc.toLowerCase();
  if (/india|bangalore|mumbai|delhi|hyderabad|pune|chennai|gurgaon|noida/.test(l)) return "in";
  if (/london|uk|england|britain|manchester|edinburgh/.test(l)) return "gb";
  return "us";
}

async function fetchRemotiveFiltered(query: PersonalizedQuery): Promise<NormalizedJob[]> {
  try {
    const r = await fetch("https://remotive.com/api/remote-jobs?limit=200", {
      headers: { "User-Agent": "JobScope/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return [];
    const j = (await r.json()) as { jobs?: RemotiveJobRaw[] };
    const all = j.jobs ?? [];
    const kw = query.keywords.map((k) => k.toLowerCase());
    const filtered = all.filter((x) => {
      const hay = `${x.title} ${x.tags?.join(" ") ?? ""} ${x.category}`.toLowerCase();
      return kw.some((k) => hay.includes(k));
    });
    return filtered
      .map<NormalizedJob>((x) => ({
        externalId: String(x.id),
        source: "remotive",
        title: x.title,
        company: x.company_name,
        location: x.candidate_required_location || "Remote",
        remote: true,
        workMode: "remote",
        description: stripHtml(x.description ?? ""),
        url: x.url,
        postedAt: new Date(x.publication_date),
        salary: { min: null, max: null, currency: null, period: null },
        category: x.category ?? "",
        tags: x.tags ?? [],
        seniority: inferSeniority(x.title),
      }))
      .filter((job) => jobMatchesProfile(query.profile, job));
  } catch {
    return [];
  }
}

export type PersonalizedSource = "remotive" | "jooble" | "adzuna";

export interface PersonalizedBatch {
  source: PersonalizedSource;
  jobs: NormalizedJob[];
  error?: string;
}

/**
 * Fetch personalized jobs from cheap+keyword-friendly sources in parallel.
 * Yields each source's batch as it completes so the client can render progressively.
 *
 * Free-tier strategy:
 *   - Remotive: unlimited; we filter the giant feed by keyword in-memory.
 *   - Jooble: 500 calls/day shared; one call per refresh.
 *   - Adzuna: 250 calls/month shared; only when allowAdzuna is true (gate this externally).
 */
export async function* streamPersonalizedJobs(
  query: PersonalizedQuery,
  opts: { allowAdzuna?: boolean } = {},
): AsyncGenerator<PersonalizedBatch> {
  const tasks: { source: PersonalizedSource; promise: Promise<NormalizedJob[]> }[] = [
    { source: "remotive", promise: fetchRemotiveFiltered(query) },
    { source: "jooble", promise: fetchJoobleKeyword(query) },
  ];
  if (opts.allowAdzuna) {
    tasks.push({ source: "adzuna", promise: fetchAdzunaKeyword(query) });
  }

  const pending = new Map(
    tasks.map((t) => [t.source, t.promise.then((jobs) => ({ source: t.source, jobs }))]),
  );
  while (pending.size > 0) {
    const winner = await Promise.race(pending.values());
    pending.delete(winner.source);
    yield winner;
  }
}

export function enrichForUpsert(jobs: NormalizedJob[]) {
  return jobs.map((j) => {
    const skills = quickSkillExtract(`${j.title} ${j.description}`);
    return {
      ...j,
      dedupeHash: dedupeHash(j.title, j.company, j.location),
      extractedSkills: skills,
      fetchedAt: new Date(),
    };
  });
}

export async function fetchAndStorePersonalizedJobs(
  query: PersonalizedQuery,
  opts: { allowAdzuna?: boolean } = {},
) {
  const summary: Record<string, { fetched: number; upserted: number; error?: string }> = {};

  for await (const batch of streamPersonalizedJobs(query, opts)) {
    const stat = { fetched: batch.jobs.length, upserted: 0 } as {
      fetched: number;
      upserted: number;
      error?: string;
    };
    try {
      if (batch.error) {
        stat.error = batch.error;
      } else if (batch.jobs.length) {
        const docs = enrichForUpsert(batch.jobs);
        const res = await Job.bulkWrite(
          docs.map((d) => ({
            updateOne: {
              filter: { externalId: d.externalId, source: d.source },
              update: { $set: d },
              upsert: true,
            },
          })) as never,
          { ordered: false },
        );
        stat.upserted = (res.upsertedCount ?? 0) + (res.modifiedCount ?? 0);
      }
    } catch (e) {
      stat.error = e instanceof Error ? e.message : "unknown";
    }
    summary[batch.source] = stat;
  }

  return summary;
}
