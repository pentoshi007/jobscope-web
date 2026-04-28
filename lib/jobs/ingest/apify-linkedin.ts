import { env } from "@/lib/env";
import { LINKEDIN_APIFY_SOURCE, LINKEDIN_APIFY_TTL_MS } from "@/lib/jobs/source-constants";
import { inferCountry } from "@/lib/match/location";
import { ApifyRun } from "@/models/apify-run";
import { Job } from "@/models/job";
import { inferSeniority, type NormalizedJob, stripHtml, type WorkMode } from "../types";
import type { IngestContext, IngestSource } from "./runner";

const DEFAULT_ACTOR_ID = "hKByXkMQaC5Qt9UMN";
const DEFAULT_LINKEDIN_SEARCH_URL = "https://www.linkedin.com/jobs/search/?position=1&pageNum=0";
const LINKEDIN_APIFY_COUNT = 100;
const APIFY_TERMINAL_STATUSES = new Set(["SUCCEEDED", "FAILED", "TIMED-OUT", "ABORTED"]);
/** Abandon run records older than 6 hours – the actor likely died silently. */
const STALE_RUN_MS = 6 * 60 * 60 * 1000;

// ─── cron-safe source ────────────────────────────────────────────────
// The LinkedIn Apify actor can take several minutes.  Rather than
// blocking the cron function and aborting when the Vercel timeout hits,
// we use a two-phase approach:
//  Phase 1 – no pending run: start the actor (fire-and-forget) and
//            persist the runId.  Return [] so other sources aren't
//            blocked.
//  Phase 2 – pending run found: poll once to see if the run finished.
//            If SUCCEEDED → read dataset, upsert jobs, return them.
//            If still running → return [].
//            If failed → clean up, optionally start a new one.

export const linkedinApifySource: IngestSource = {
  source: LINKEDIN_APIFY_SOURCE,
  enabled: Boolean(env.APIFY_API_TOKEN),
  quality: 84,
  maxRunMs: 20_000,
  async fetchJobs(ctx) {
    if (!env.APIFY_API_TOKEN) return [];

    // If we already have fresh jobs there's nothing to do.
    const freshCache = await hasFreshLinkedInApifyJobs();
    if (freshCache) return [];

    const actorId = actorPathId(env.APIFY_LINKEDIN_ACTOR_ID || DEFAULT_ACTOR_ID);

    // ── Check for a previously started run ──────────────────────
    const pending = await ApifyRun.findOne({
      status: { $nin: [...APIFY_TERMINAL_STATUSES] },
      ingested: false,
      startedAt: { $gte: new Date(Date.now() - STALE_RUN_MS) },
    }).sort({ startedAt: -1 });

    if (pending?.runId) {
      const run = await getApifyRun(pending.runId);

      if (run.status && APIFY_TERMINAL_STATUSES.has(run.status)) {
        await ApifyRun.updateOne(
          { _id: pending._id },
          { status: run.status, defaultDatasetId: run.defaultDatasetId ?? "", completedAt: new Date() },
        );

        if (run.status === "SUCCEEDED" && run.defaultDatasetId) {
          const items = await getApifyDatasetItems(run.defaultDatasetId);
          await ApifyRun.updateOne({ _id: pending._id }, { ingested: true });
          return items
            .map((item) => normalizeLinkedInItem(item as LinkedInApifyItem, ctx))
            .filter((job): job is NormalizedJob => Boolean(job));
        }
        // Non-success terminal – fall through to start a new run.
      } else {
        // Still running – leave it alone.
        return [];
      }
    }

    // Clean up stale/old pending records.
    await ApifyRun.deleteMany({
      $or: [
        { startedAt: { $lt: new Date(Date.now() - STALE_RUN_MS) }, ingested: false },
        { ingested: true },
      ],
    });

    // ── Phase 1: fire-and-forget a new run ──────────────────────
    const started = await startApifyActor(actorId);
    if (started.id) {
      await ApifyRun.create({
        runId: started.id,
        actorId,
        status: started.status ?? "RUNNING",
        defaultDatasetId: started.defaultDatasetId ?? "",
        origin: "cron",
      });
    }

    // We'll pick up the data on the next cron tick.
    return [];
  },
};

// ─── manual (admin) run – waits for completion ───────────────────────
export async function runApifyManual(
  onProgress?: (msg: string) => void,
): Promise<NormalizedJob[]> {
  if (!env.APIFY_API_TOKEN) throw new Error("APIFY_API_TOKEN not configured");
  const actorId = actorPathId(env.APIFY_LINKEDIN_ACTOR_ID || DEFAULT_ACTOR_ID);

  onProgress?.("Starting Apify LinkedIn actor…");
  const started = await startApifyActor(actorId);
  if (!started.id) throw new Error("Apify did not return a run ID");

  await ApifyRun.create({
    runId: started.id,
    actorId,
    status: started.status ?? "RUNNING",
    defaultDatasetId: started.defaultDatasetId ?? "",
    origin: "admin",
  });

  onProgress?.(`Run ${started.id} started. Polling for completion…`);

  // Poll indefinitely (no deadline) until the actor finishes.
  let run = started;
  let polls = 0;
  while (run.status && !APIFY_TERMINAL_STATUSES.has(run.status)) {
    await sleep(3_000);
    run = await getApifyRun(started.id);
    polls++;
    if (polls % 5 === 0) {
      onProgress?.(`Still running… (polled ${polls} times, status=${run.status})`);
    }
  }

  await ApifyRun.updateOne(
    { runId: started.id },
    { status: run.status, defaultDatasetId: run.defaultDatasetId ?? "", completedAt: new Date() },
  );

  if (run.status !== "SUCCEEDED") {
    throw new Error(`Apify LinkedIn actor ended with status ${run.status}`);
  }
  if (!run.defaultDatasetId) {
    throw new Error("Apify LinkedIn actor did not return a default dataset");
  }

  onProgress?.("Fetching dataset items…");
  const items = await getApifyDatasetItems(run.defaultDatasetId);
  await ApifyRun.updateOne({ runId: started.id }, { ingested: true });

  onProgress?.(`Got ${items.length} items. Normalizing…`);
  const dummyCtx: IngestContext = { roles: [], countries: [], cities: [], deadlineAt: Infinity };
  return items
    .map((item) => normalizeLinkedInItem(item as LinkedInApifyItem, dummyCtx))
    .filter((job): job is NormalizedJob => Boolean(job));
}

// ─── Apify HTTP helpers ──────────────────────────────────────────────

interface ApifyRun {
  id?: string;
  status?: string;
  defaultDatasetId?: string;
}

/**
 * Start the actor with waitForFinish=0 so the HTTP call returns
 * immediately with the run metadata.
 */
async function startApifyActor(actorId: string): Promise<ApifyRun> {
  const response = await apifyJson<ApifyRun | { data?: ApifyRun }>(
    `https://api.apify.com/v2/acts/${actorId}/runs?${apifyParams({
      waitForFinish: "0",
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
      signal: AbortSignal.timeout(30_000),
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

async function getApifyRun(runId: string): Promise<ApifyRun> {
  const response = await apifyJson<ApifyRun | { data?: ApifyRun }>(
    `https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}?${apifyParams()}`,
    { signal: AbortSignal.timeout(10_000) },
  );
  return unwrapApifyData(response);
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

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function hasFreshLinkedInApifyJobs(now = new Date()) {
  const fetchedAfter = new Date(now.getTime() - LINKEDIN_APIFY_TTL_MS);
  const existing = await Job.exists({
    source: LINKEDIN_APIFY_SOURCE,
    $or: [{ cacheExpiresAt: { $gte: now } }, { fetchedAt: { $gte: fetchedAfter } }],
  });
  return Boolean(existing);
}

// ─── normalisation helpers ──────────────────────────────────────────

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
