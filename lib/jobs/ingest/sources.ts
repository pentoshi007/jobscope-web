import { env } from "@/lib/env";
import { adzunaAdapter } from "@/lib/jobs/adapters/adzuna";
import { arbeitnowAdapter } from "@/lib/jobs/adapters/arbeitnow";
import { joobleAdapter } from "@/lib/jobs/adapters/jooble";
import { jsearchAdapter } from "@/lib/jobs/adapters/jsearch";
import { remotiveAdapter } from "@/lib/jobs/adapters/remotive";
import { museAdapter } from "@/lib/jobs/adapters/themuse";
import { usajobsAdapter } from "@/lib/jobs/adapters/usajobs";
import { ATS_COMPANIES, type AtsCompany } from "@/lib/jobs/ats-companies";
import { inferSeniority, type NormalizedJob, stripHtml } from "@/lib/jobs/types";
import { inferCountry } from "@/lib/match/location";
import { linkedinApifySource } from "./apify-linkedin";
import type { IngestContext, IngestSource } from "./runner";
import { safeFetchJson, safeFetchText } from "./safe-fetch";

const DEFAULT_ROLES = ["software engineer", "developer", "data analyst", "frontend developer"];
const DEFAULT_CITIES = ["India", "Bengaluru", "Hyderabad", "Pune", "Mumbai", "Delhi NCR"];

export function buildIngestSources(): IngestSource[] {
  return [
    linkedinApifySource,
    wrapLegacyAdapter(adzunaAdapter, 72, 18_000),
    wrapLegacyAdapter(joobleAdapter, 68, 18_000),
    wrapLegacyAdapter(jsearchAdapter, 70, 18_000),
    careerjetSource,
    indianApiSource,
    careerNestSource,
    freshersworldSource,
    atsSource,
    wrapLegacyAdapter(remotiveAdapter, 45, 12_000),
    wrapLegacyAdapter(museAdapter, 42, 12_000),
    wrapLegacyAdapter(arbeitnowAdapter, 38, 12_000),
    wrapLegacyAdapter(usajobsAdapter, 25, 12_000),
  ];
}

function wrapLegacyAdapter(
  adapter: {
    source: string;
    fetch: () => Promise<unknown[]>;
    normalize: (raw: unknown) => NormalizedJob | null;
  },
  quality: number,
  maxRunMs: number,
): IngestSource {
  return {
    source: adapter.source,
    enabled: true,
    quality,
    maxRunMs,
    async fetchJobs() {
      const raw = await adapter.fetch();
      return raw
        .map((item) => adapter.normalize(item))
        .filter((job): job is NormalizedJob => !!job);
    },
  };
}

const careerjetSource: IngestSource = {
  source: "careerjet",
  enabled: Boolean(env.CAREERJET_API_KEY),
  quality: 70,
  maxRunMs: 16_000,
  async fetchJobs(ctx) {
    if (!env.CAREERJET_API_KEY) return [];
    const roles = roleQueries(ctx).slice(0, 3);
    const locations = locationQueries(ctx).slice(0, 4);
    const jobs: NormalizedJob[] = [];
    for (const role of roles) {
      for (const location of locations) {
        if (Date.now() >= ctx.deadlineAt) return jobs;
        const params = new URLSearchParams({
          locale_code: "en_IN",
          keywords: role,
          location,
          page_size: "25",
          sort: "date",
          user_ip: "127.0.0.1",
          user_agent: "JobScope/1.0",
        });
        const data = await safeFetchJson<CareerjetResponse>(
          `https://search.api.careerjet.net/v4/query?${params.toString()}`,
          {
            source: "careerjet",
            label: `${role}:${location}`,
            headers: {
              Authorization: `Basic ${Buffer.from(`${env.CAREERJET_API_KEY}:`).toString("base64")}`,
            },
            timeoutMs: 10_000,
            quietStatuses: [403],
            meta: { role, location },
          },
        ).catch(() => ({ jobs: [] }));
        jobs.push(...(data.jobs ?? []).map((job) => normalizeCareerjet(job)));
      }
    }
    return jobs;
  },
};

const indianApiSource: IngestSource = {
  source: "indianapi",
  enabled: Boolean(env.INDIANAPI_JOBS_KEY),
  quality: 66,
  maxRunMs: 12_000,
  async fetchJobs(ctx) {
    if (!env.INDIANAPI_JOBS_KEY) return [];
    const jobs: NormalizedJob[] = [];
    for (const role of roleQueries(ctx).slice(0, 4)) {
      if (Date.now() >= ctx.deadlineAt) return jobs;
      const params = new URLSearchParams({ limit: "40", title: role });
      const data = await safeFetchJson<IndianApiJob[]>(
        `https://jobs.indianapi.in/jobs?${params.toString()}`,
        {
          source: "indianapi",
          label: role,
          headers: { "X-Api-Key": env.INDIANAPI_JOBS_KEY },
          timeoutMs: 10_000,
          meta: { role },
        },
      ).catch(() => []);
      jobs.push(...data.map(normalizeIndianApi));
    }
    return jobs;
  },
};

const careerNestSource: IngestSource = {
  source: "careernest",
  enabled: true,
  quality: 46,
  maxRunMs: 10_000,
  async fetchJobs(ctx) {
    const locations = locationQueries(ctx).slice(0, 3);
    const jobs: NormalizedJob[] = [];
    for (const location of locations) {
      const params = new URLSearchParams({ limit: "50", location });
      const data = await safeFetchJson<CareerNestResponse>(
        `https://careernest.cloud/api/feed?${params.toString()}`,
        { source: "careernest", label: location, timeoutMs: 8_000, meta: { location } },
      ).catch(() => ({ jobs: [] }));
      jobs.push(...(data.jobs ?? []).map(normalizeCareerNest));
    }
    return jobs;
  },
};

const freshersworldSource: IngestSource = {
  source: "freshersworld",
  enabled: true,
  quality: 54,
  maxRunMs: 8_000,
  async fetchJobs() {
    const text = await safeFetchText("https://freshersworld.com/feed", {
      source: "freshersworld",
      label: "rss",
      timeoutMs: 8_000,
      maxBytes: 800_000,
    }).catch(() => "");
    return parseFreshersworldFeed(text);
  },
};

const atsSource: IngestSource = {
  source: "ats",
  enabled: ATS_COMPANIES.length > 0,
  quality: 78,
  maxRunMs: 18_000,
  async fetchJobs(ctx) {
    const jobs: NormalizedJob[] = [];
    for (const company of ATS_COMPANIES.sort((a, b) => b.priority - a.priority).slice(0, 10)) {
      if (Date.now() >= ctx.deadlineAt) return jobs;
      jobs.push(...(await fetchAtsCompany(company)));
    }
    return jobs.filter((job) => isRelevantCountry(ctx, job));
  },
};

function roleQueries(ctx: IngestContext) {
  return unique([...(ctx.roles.length ? ctx.roles : DEFAULT_ROLES), ...DEFAULT_ROLES]);
}

function locationQueries(ctx: IngestContext) {
  return unique([...(ctx.cities.length ? ctx.cities : DEFAULT_CITIES), ...ctx.countries, "India"]);
}

function isRelevantCountry(ctx: IngestContext, job: NormalizedJob) {
  const country = inferCountry(job.location);
  if (!country) return true;
  return ctx.countries.length === 0 || ctx.countries.includes(country) || job.remote;
}

interface CareerjetResponse {
  jobs?: CareerjetJob[];
}

interface CareerjetJob {
  url?: string;
  title?: string;
  company?: string;
  locations?: string;
  description?: string;
  date?: string;
  salary_currency_code?: string;
  salary_min?: number;
  salary_max?: number;
  salary_type?: string;
  site?: string;
}

function normalizeCareerjet(job: CareerjetJob): NormalizedJob {
  const loc = job.locations ?? "";
  const remote = /remote|work from home|wfh/i.test(`${loc} ${job.title ?? ""}`);
  return {
    externalId: job.url ?? `${job.title}-${job.company}-${loc}`,
    source: "careerjet",
    title: job.title ?? "",
    company: job.company ?? "Unknown",
    location: loc,
    country: inferCountry(loc),
    remote,
    workMode: remote ? "remote" : "onsite",
    description: stripHtml(job.description ?? ""),
    url: job.url ?? "",
    postedAt: job.date ? new Date(job.date) : new Date(),
    salary: {
      min: job.salary_min ?? null,
      max: job.salary_max ?? null,
      currency: job.salary_currency_code ?? null,
      period: salaryPeriod(job.salary_type),
    },
    category: job.site ?? "",
    tags: [],
    seniority: inferSeniority(job.title ?? ""),
  };
}

interface IndianApiJob {
  id?: number | string;
  title?: string;
  company?: string;
  job_description?: string;
  job_title?: string;
  job_type?: string;
  location?: string;
  education_and_skills?: string;
  apply_link?: string;
  posted_date?: string;
}

function normalizeIndianApi(job: IndianApiJob): NormalizedJob {
  const title = job.job_title || job.title || "";
  const loc = job.location ?? "India";
  const remote = /remote|work from home|wfh/i.test(`${loc} ${title}`);
  return {
    externalId: String(job.id ?? job.apply_link ?? `${title}-${job.company}-${loc}`),
    source: "indianapi",
    title,
    company: job.company ?? "Unknown",
    location: loc,
    country: inferCountry(loc) || "India",
    remote,
    workMode: remote ? "remote" : "onsite",
    description: stripHtml(`${job.job_description ?? ""} ${job.education_and_skills ?? ""}`),
    url: job.apply_link ?? "",
    postedAt: job.posted_date ? new Date(job.posted_date) : new Date(),
    salary: { min: null, max: null, currency: null, period: null },
    category: job.job_type ?? "",
    tags: [],
    seniority: inferSeniority(title),
  };
}

interface CareerNestResponse {
  jobs?: CareerNestJob[];
}

interface CareerNestJob {
  id?: number | string;
  title?: string;
  company?: string;
  location?: string;
  job_type?: string;
  category?: string;
  description?: string;
  salary?: { min?: number; max?: number; currency?: string };
  posted_at?: string;
  apply_url?: string;
  job_url?: string;
}

function normalizeCareerNest(job: CareerNestJob): NormalizedJob {
  const loc = job.location ?? "";
  const remote = /remote|work from home|wfh/i.test(`${loc} ${job.job_type ?? ""}`);
  return {
    externalId: String(job.id ?? job.apply_url ?? job.job_url),
    source: "careernest",
    title: job.title ?? "",
    company: job.company ?? "Unknown",
    location: loc,
    country: inferCountry(loc),
    remote,
    workMode: remote ? "remote" : "onsite",
    description: stripHtml(job.description ?? ""),
    url: job.apply_url ?? job.job_url ?? "",
    postedAt: job.posted_at ? new Date(job.posted_at) : new Date(),
    salary: {
      min: job.salary?.min ?? null,
      max: job.salary?.max ?? null,
      currency: job.salary?.currency ?? null,
      period: "year",
    },
    category: job.category ?? job.job_type ?? "",
    tags: [],
    seniority: inferSeniority(job.title ?? ""),
  };
}

function parseFreshersworldFeed(text: string): NormalizedJob[] {
  const urls = [...text.matchAll(/https:\/\/www\.freshersworld\.com\/jobs\/[^\s<]+/g)].map(
    (match) => match[0],
  );
  return unique(urls)
    .slice(0, 80)
    .map((url) => {
      const slug = decodeURIComponent(url.split("/jobs/")[1]?.split("?")[0] ?? "");
      const title = titleFromFreshersworldSlug(slug);
      const loc = locationFromFreshersworldSlug(slug);
      const remote = /remote|work-from-home|wfh/i.test(slug);
      return {
        externalId: url.replace(/[?#].*$/, ""),
        source: "freshersworld",
        title,
        company: companyFromFreshersworldSlug(slug),
        location: loc || "India",
        country: "India",
        remote,
        workMode: remote ? "remote" : "onsite",
        description: "",
        url,
        postedAt: new Date(),
        salary: { min: null, max: null, currency: null, period: null },
        category: "",
        tags: [],
        seniority: inferSeniority(title),
      };
    });
}

async function fetchAtsCompany(company: AtsCompany): Promise<NormalizedJob[]> {
  if (company.ats === "greenhouse") return fetchGreenhouse(company);
  if (company.ats === "lever") return fetchLever(company);
  if (company.ats === "ashby") return fetchAshby(company);
  return fetchWorkable(company);
}

async function fetchGreenhouse(company: AtsCompany) {
  const data = await safeFetchJson<{
    jobs?: Array<{
      id: number;
      title: string;
      absolute_url: string;
      location?: { name?: string };
      content?: string;
      updated_at?: string;
    }>;
  }>(`https://boards-api.greenhouse.io/v1/boards/${company.token}/jobs?content=true`, {
    source: "ats",
    label: `greenhouse:${company.token}`,
    timeoutMs: 8_000,
    quietStatuses: [404],
    meta: { company: company.company, ats: company.ats },
  }).catch(() => ({ jobs: [] }));
  return (data.jobs ?? []).map((job) =>
    normalizeAtsJob(
      company,
      String(job.id),
      job.title,
      job.location?.name ?? "",
      job.absolute_url,
      job.content,
      job.updated_at,
    ),
  );
}

async function fetchLever(company: AtsCompany) {
  const data = await safeFetchJson<
    Array<{
      id: string;
      text: string;
      hostedUrl: string;
      descriptionPlain?: string;
      createdAt?: number;
      categories?: { location?: string; commitment?: string; team?: string };
    }>
  >(`https://api.lever.co/v0/postings/${company.token}?mode=json`, {
    source: "ats",
    label: `lever:${company.token}`,
    timeoutMs: 8_000,
    quietStatuses: [404],
    meta: { company: company.company, ats: company.ats },
  }).catch(() => []);
  return data.map((job) =>
    normalizeAtsJob(
      company,
      job.id,
      job.text,
      job.categories?.location ?? "",
      job.hostedUrl,
      job.descriptionPlain,
      job.createdAt ? new Date(job.createdAt).toISOString() : undefined,
      job.categories?.team,
    ),
  );
}

async function fetchAshby(company: AtsCompany) {
  const data = await safeFetchJson<{
    jobs?: Array<{
      id: string;
      title: string;
      location?: string;
      jobUrl?: string;
      applyUrl?: string;
      descriptionPlain?: string;
      listedAt?: string;
      department?: string;
      workplaceType?: string;
    }>;
  }>(
    `https://api.ashbyhq.com/posting-api/job-board/${company.token}?includeCompensation=true&listedOnly=true`,
    {
      source: "ats",
      label: `ashby:${company.token}`,
      timeoutMs: 8_000,
      quietStatuses: [404],
      meta: { company: company.company, ats: company.ats },
    },
  ).catch(() => ({ jobs: [] }));
  return (data.jobs ?? []).map((job) =>
    normalizeAtsJob(
      company,
      job.id,
      job.title,
      job.location ?? job.workplaceType ?? "",
      job.applyUrl ?? job.jobUrl ?? "",
      job.descriptionPlain,
      job.listedAt,
      job.department,
    ),
  );
}

async function fetchWorkable(company: AtsCompany) {
  const data = await safeFetchJson<{
    jobs?: Array<{
      shortcode: string;
      title: string;
      url?: string;
      created_at?: string;
      description?: string;
      location?: { location_str?: string };
    }>;
  }>(`https://apply.workable.com/api/v1/widget/accounts/${company.token}`, {
    source: "ats",
    label: `workable:${company.token}`,
    timeoutMs: 8_000,
    quietStatuses: [404],
    meta: { company: company.company, ats: company.ats },
  }).catch(() => ({ jobs: [] }));
  return (data.jobs ?? []).map((job) =>
    normalizeAtsJob(
      company,
      job.shortcode,
      job.title,
      job.location?.location_str ?? "",
      job.url ?? "",
      job.description,
      job.created_at,
    ),
  );
}

function normalizeAtsJob(
  company: AtsCompany,
  id: string,
  title: string,
  location: string,
  url: string,
  description = "",
  postedAt?: string,
  category = "",
): NormalizedJob {
  const remote = /remote|work from home|wfh/i.test(`${location} ${title}`);
  return {
    externalId: `${company.ats}-${company.token}-${id}`,
    source: "ats",
    title,
    company: company.company,
    location,
    country: inferCountry(location),
    remote,
    workMode: remote ? "remote" : /hybrid/i.test(location) ? "hybrid" : "onsite",
    description: stripHtml(description),
    url,
    postedAt: postedAt ? new Date(postedAt) : new Date(),
    salary: { min: null, max: null, currency: null, period: null },
    category,
    tags: [company.ats],
    seniority: inferSeniority(title),
  };
}

function titleFromFreshersworldSlug(slug: string) {
  return titleCase(slug.split("-jobs-opening")[0]?.replace(/-/g, " ") || "Freshersworld job");
}

function companyFromFreshersworldSlug(slug: string) {
  const match = slug.match(/opening-in-(.*?)-at-/);
  return titleCase(match?.[1]?.replace(/-/g, " ") || "Freshersworld");
}

function locationFromFreshersworldSlug(slug: string) {
  const match = slug.match(/-at-([a-z0-9-]+)-\d+/);
  return titleCase(match?.[1]?.replace(/-/g, " ") || "India");
}

function titleCase(value: string) {
  return value.replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

function salaryPeriod(value?: string): NormalizedJob["salary"]["period"] {
  if (value === "Y") return "year";
  if (value === "M") return "month";
  if (value === "H") return "hour";
  return null;
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
