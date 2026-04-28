import { env } from "@/lib/env";
import { LINKEDIN_APIFY_SOURCE, LINKEDIN_APIFY_TTL_MS } from "@/lib/jobs/source-constants";
import { inferCountry } from "@/lib/match/location";
import { Job } from "@/models/job";
import { inferSeniority, type NormalizedJob, stripHtml, type WorkMode } from "../types";
import type { IngestContext, IngestSource } from "./runner";

const DEFAULT_ACTOR_ID = "hKByXkMQaC5Qt9UMN";
const DEFAULT_LINKEDIN_SEARCH_URL = "https://www.linkedin.com/jobs/search/?position=1&pageNum=0";
const LINKEDIN_APIFY_COUNT = 100;

export const linkedinApifySource: IngestSource = {
  source: LINKEDIN_APIFY_SOURCE,
  enabled: Boolean(env.APIFY_API_TOKEN),
  quality: 84,
  maxRunMs: 45_000,
  async fetchJobs(ctx) {
    if (!env.APIFY_API_TOKEN) return [];

    const freshCache = await hasFreshLinkedInApifyJobs();
    if (freshCache) return [];

    const waitSecs = Math.max(1, Math.floor((ctx.deadlineAt - Date.now()) / 1000));
    const actorId = actorPathId(env.APIFY_LINKEDIN_ACTOR_ID || DEFAULT_ACTOR_ID);
    const run = await runApifyActor(actorId, waitSecs);

    if (typeof run.status === "string" && run.status !== "SUCCEEDED") {
      if (typeof run.id === "string") {
        await abortApifyRun(run.id);
      }
      throw new Error(`Apify LinkedIn actor ended with status ${run.status}`);
    }
    if (!run.defaultDatasetId) {
      throw new Error("Apify LinkedIn actor did not return a default dataset");
    }

    const items = await getApifyDatasetItems(run.defaultDatasetId);

    return items
      .map((item) => normalizeLinkedInItem(item as LinkedInApifyItem, ctx))
      .filter((job): job is NormalizedJob => Boolean(job));
  },
};

interface ApifyRun {
  id?: string;
  status?: string;
  defaultDatasetId?: string;
}

async function runApifyActor(actorId: string, waitSecs: number): Promise<ApifyRun> {
  const response = await apifyJson<ApifyRun | { data?: ApifyRun }>(
    `https://api.apify.com/v2/acts/${actorId}/runs?${apifyParams({
      waitForFinish: String(waitSecs),
    })}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        urls: [DEFAULT_LINKEDIN_SEARCH_URL],
        scrapeCompany: true,
        count: LINKEDIN_APIFY_COUNT,
        splitByLocation: false,
      }),
      signal: AbortSignal.timeout(Math.max(1, waitSecs + 2) * 1000),
    },
  );
  return unwrapApifyData(response);
}

async function getApifyDatasetItems(datasetId: string) {
  const data = await apifyJson<LinkedInApifyItem[] | { items?: LinkedInApifyItem[] }>(
    `https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items?${apifyParams({
      clean: "true",
      limit: String(LINKEDIN_APIFY_COUNT),
    })}`,
    { signal: AbortSignal.timeout(15_000) },
  );
  return Array.isArray(data) ? data : (data.items ?? []);
}

async function abortApifyRun(runId: string) {
  await apifyJson<ApifyRun | { data?: ApifyRun }>(
    `https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}/abort?${apifyParams()}`,
    { method: "POST", signal: AbortSignal.timeout(10_000) },
  ).catch(() => undefined);
}

async function apifyJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const details = await res.text().catch(() => "");
    throw new Error(`Apify LinkedIn request failed: ${res.status} ${details.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

function apifyParams(extra: Record<string, string> = {}) {
  return new URLSearchParams({ token: env.APIFY_API_TOKEN ?? "", ...extra }).toString();
}

function unwrapApifyData<T>(response: T | { data?: T }) {
  if (response && typeof response === "object" && "data" in response && response.data) {
    return response.data;
  }
  return response as T;
}

function actorPathId(actorId: string) {
  return encodeURIComponent(actorId.replace(/\//g, "~"));
}

export async function hasFreshLinkedInApifyJobs(now = new Date()) {
  const fetchedAfter = new Date(now.getTime() - LINKEDIN_APIFY_TTL_MS);
  const existing = await Job.exists({
    source: LINKEDIN_APIFY_SOURCE,
    $or: [{ cacheExpiresAt: { $gte: now } }, { fetchedAt: { $gte: fetchedAfter } }],
  });
  return Boolean(existing);
}

type LinkedInApifyItem = Record<string, unknown>;

function normalizeLinkedInItem(item: LinkedInApifyItem, ctx: IngestContext): NormalizedJob | null {
  const title = firstString(item, ["title", "jobTitle", "positionName", "position"]);
  const url = firstString(item, ["url", "jobUrl", "link", "jobLink", "applyUrl"]);
  if (!title || !url) return null;

  const company =
    firstString(item, ["company", "companyName", "companyTitle", "employerName"]) ||
    nestedString(item.company, ["name", "title"]) ||
    "Unknown";
  const location =
    firstString(item, ["location", "jobLocation", "place", "formattedLocation"]) ||
    nestedString(item.location, ["name", "text"]) ||
    "";
  const description = firstString(item, [
    "description",
    "jobDescription",
    "descriptionText",
    "descriptionHtml",
  ]);
  const remote = /remote|work from home|wfh/i.test(`${location} ${title} ${description}`);
  const workMode = inferWorkMode(`${location} ${title} ${description}`, remote);
  const postedAt = parseDate(
    firstString(item, ["postedAt", "postedDate", "publishedAt", "listedAt", "createdAt", "date"]),
  );
  const country = inferCountry(location) || preferredCountry(ctx);

  return {
    externalId: stableLinkedInId(item, url, title, company, location),
    source: LINKEDIN_APIFY_SOURCE,
    title,
    company,
    location,
    country,
    remote,
    workMode,
    description: stripHtml(description),
    url,
    postedAt,
    salary: { min: null, max: null, currency: null, period: null },
    category: firstString(item, ["employmentType", "jobType", "industry"]) || "",
    tags: ["linkedin", "apify"],
    seniority: inferSeniority(title),
  };
}

function firstString(item: LinkedInApifyItem, keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function nestedString(value: unknown, keys: string[]) {
  if (!value || typeof value !== "object") return "";
  return firstString(value as LinkedInApifyItem, keys);
}

function parseDate(value: string) {
  const parsed = value ? new Date(value) : null;
  return parsed && Number.isFinite(parsed.getTime()) ? parsed : new Date();
}

function inferWorkMode(text: string, remote: boolean): WorkMode {
  if (remote) return "remote";
  if (/hybrid/i.test(text)) return "hybrid";
  return "onsite";
}

function preferredCountry(ctx: IngestContext) {
  return ctx.countries[0] ?? "";
}

function stableLinkedInId(
  item: LinkedInApifyItem,
  url: string,
  title: string,
  company: string,
  location: string,
) {
  return (
    firstString(item, ["id", "jobId", "jobPostingId", "linkedinJobId"]) ||
    linkedinIdFromUrl(url) ||
    url ||
    `${title}-${company}-${location}`
  );
}

function linkedinIdFromUrl(url: string) {
  const match = url.match(/(?:currentJobId=|\/jobs\/view\/)(\d+)/);
  return match?.[1] ?? "";
}
