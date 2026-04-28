import { errorToLog, logAppEvent } from "../../app-log";
import { env } from "../../env";
import { inferSeniority, type JobAdapter, type NormalizedJob, stripHtml } from "../types";

interface JSearchJob {
  job_id: string;
  job_title: string;
  employer_name: string;
  job_city?: string;
  job_country?: string;
  job_is_remote: boolean;
  job_description: string;
  job_apply_link: string;
  job_posted_at_datetime_utc?: string;
  job_min_salary?: number;
  job_max_salary?: number;
  job_salary_currency?: string;
  job_salary_period?: string;
  job_employment_type?: string;
}

export const jsearchAdapter: JobAdapter = {
  source: "jsearch",
  async fetch() {
    try {
      const r = await fetch(
        "https://jsearch.p.rapidapi.com/search?query=software%20engineer%20in%20india&page=1&num_pages=1",
        {
          headers: {
            "x-rapidapi-key": env.RAPIDAPI_KEY,
            "x-rapidapi-host": "jsearch.p.rapidapi.com",
          },
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!r.ok) throw new Error(`JSearch ${r.status}`);
      const j = (await r.json()) as { data: JSearchJob[] };
      return j.data ?? [];
    } catch (e) {
      const details = errorToLog(e);
      await logAppEvent({
        kind: "job_source",
        source: "jobs.jsearch",
        path: "/api/cron/fetch-jobs",
        message: details.message,
        stack: details.stack,
      });
      return [];
    }
  },
  normalize(raw): NormalizedJob | null {
    const r = raw as JSearchJob;
    if (!r?.job_id) return null;
    const loc = [r.job_city, r.job_country].filter(Boolean).join(", ");
    return {
      externalId: r.job_id,
      source: "jsearch",
      title: r.job_title,
      company: r.employer_name,
      location: loc,
      remote: !!r.job_is_remote,
      workMode: r.job_is_remote ? "remote" : "onsite",
      description: stripHtml(r.job_description ?? ""),
      url: r.job_apply_link,
      postedAt: r.job_posted_at_datetime_utc ? new Date(r.job_posted_at_datetime_utc) : new Date(),
      salary: {
        min: r.job_min_salary ?? null,
        max: r.job_max_salary ?? null,
        currency: r.job_salary_currency ?? null,
        period: (r.job_salary_period?.toLowerCase() as never) ?? null,
      },
      category: r.job_employment_type ?? "",
      tags: [],
      seniority: inferSeniority(r.job_title),
    };
  },
};
