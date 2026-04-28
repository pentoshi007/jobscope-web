import { errorToLog, logAppEvent } from "../../app-log";
import { env } from "../../env";
import { inferSeniority, type JobAdapter, type NormalizedJob, stripHtml } from "../types";

interface AdzunaJob {
  id: string;
  title: string;
  company: { display_name: string };
  location: { display_name: string };
  description: string;
  redirect_url: string;
  created: string;
  salary_min?: number;
  salary_max?: number;
  category: { label: string };
  contract_time?: string;
}

const COUNTRIES = ["in", "gb", "us"] as const;

export const adzunaAdapter: JobAdapter = {
  source: "adzuna",
  async fetch() {
    const all: (AdzunaJob & { __country: string })[] = [];
    for (const c of COUNTRIES) {
      try {
        const url = `https://api.adzuna.com/v1/api/jobs/${c}/search/1?app_id=${env.ADZUNA_APP_ID}&app_key=${env.ADZUNA_APP_KEY}&results_per_page=50&what=engineer`;
        const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (!r.ok) continue;
        const j = (await r.json()) as { results: AdzunaJob[] };
        for (const it of j.results ?? []) all.push({ ...it, __country: c });
      } catch (e) {
        const details = errorToLog(e);
        await logAppEvent({
          kind: "job_source",
          source: "jobs.adzuna",
          path: "/api/cron/fetch-jobs",
          message: details.message,
          stack: details.stack,
          meta: { country: c },
        });
      }
    }
    return all;
  },
  normalize(raw): NormalizedJob | null {
    const r = raw as AdzunaJob & { __country: string };
    if (!r?.id) return null;
    const ccy = r.__country === "in" ? "INR" : r.__country === "gb" ? "GBP" : "USD";
    const loc = r.location?.display_name ?? "";
    const remote = /remote/i.test(loc) || /remote/i.test(r.title);
    return {
      externalId: `${r.__country}-${r.id}`,
      source: "adzuna",
      title: r.title,
      company: r.company?.display_name ?? "",
      location: loc,
      remote,
      workMode: remote ? "remote" : "onsite",
      description: stripHtml(r.description ?? ""),
      url: r.redirect_url,
      postedAt: new Date(r.created),
      salary: {
        min: r.salary_min ?? null,
        max: r.salary_max ?? null,
        currency: r.salary_min || r.salary_max ? ccy : null,
        period: "year",
      },
      category: r.category?.label ?? "",
      tags: [],
      seniority: inferSeniority(r.title),
    };
  },
};
