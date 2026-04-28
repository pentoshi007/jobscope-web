import { env } from "../env";
import type { ParsedResume } from "../resume/schema";
import { dedupeHash } from "./dedupe";
import { quickSkillExtract } from "./enrich";
import { inferSeniority, type NormalizedJob, stripHtml } from "./types";

const ROLE_NORMALIZE: { match: RegExp; canonical: string }[] = [
  { match: /\bfront[-\s]?end|react|vue|angular|svelte\b/i, canonical: "frontend developer" },
  { match: /\bback[-\s]?end|node|python|java|golang|ruby|php\b/i, canonical: "backend developer" },
  { match: /\bfull[-\s]?stack\b/i, canonical: "full stack developer" },
  { match: /\bdev[-\s]?ops|sre|infrastructure|platform\b/i, canonical: "devops engineer" },
  { match: /\bdata\s*(engineer|scientist|analyst)\b/i, canonical: "data engineer" },
  { match: /\bmachine learning|ml engineer|ai\b/i, canonical: "machine learning engineer" },
  {
    match: /\bmobile|android|ios|swift|kotlin|flutter|react native\b/i,
    canonical: "mobile developer",
  },
  { match: /\bqa|test|sdet\b/i, canonical: "qa engineer" },
  { match: /\bdesign|ux|ui\b/i, canonical: "product designer" },
];

export interface PersonalizedQuery {
  keywords: string[];
  primaryRole: string;
  seniority: ParsedResume["inferredSeniority"];
  locations: string[];
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
    };
  }

  const skillCount = new Map<string, number>();
  const roleText: string[] = [];
  let years = 0;
  let seniority: ParsedResume["inferredSeniority"] = "mid";

  for (const r of resumes) {
    if (r.headline) roleText.push(r.headline);
    for (const e of r.experience.slice(0, 3)) if (e.role) roleText.push(e.role);
    years = Math.max(years, r.totalYearsExperience);
    seniority = r.inferredSeniority;
    const top = [
      ...r.skills.languages,
      ...r.skills.frameworks,
      ...r.skills.databases,
      ...r.skills.cloud,
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

  let primaryRole = "software engineer";
  const joined = roleText.join(" ");
  for (const r of ROLE_NORMALIZE) {
    if (r.match.test(joined)) {
      primaryRole = r.canonical;
      break;
    }
  }

  const keywords = Array.from(new Set([...topSkills.slice(0, 3), primaryRole])).filter(Boolean);
  return { keywords, primaryRole, seniority, locations: preferredLocations };
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
      }));
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
      });
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
    return filtered.map<NormalizedJob>((x) => ({
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
    }));
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
