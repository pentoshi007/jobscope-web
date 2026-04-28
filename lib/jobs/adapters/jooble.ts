import { errorToLog, logAppEvent } from "../../app-log";
import { env } from "../../env";
import { inferSeniority, type JobAdapter, type NormalizedJob, stripHtml } from "../types";

interface JoobleJob {
  id: number;
  title: string;
  company: string;
  location: string;
  snippet: string;
  link: string;
  updated: string;
  salary: string;
  type: string;
}

export const joobleAdapter: JobAdapter = {
  source: "jooble",
  async fetch() {
    const all: JoobleJob[] = [];
    for (const keyword of ["software engineer", "developer"]) {
      try {
        const r = await fetch(`https://jooble.org/api/${env.JOOBLE_API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keywords: keyword, location: "India", page: 1 }),
          signal: AbortSignal.timeout(15000),
        });
        if (!r.ok) continue;
        const j = (await r.json()) as { jobs: JoobleJob[] };
        all.push(...(j.jobs ?? []));
      } catch (e) {
        const details = errorToLog(e);
        await logAppEvent({
          kind: "job_source",
          source: "jobs.jooble",
          path: "/api/cron/fetch-jobs",
          message: details.message,
          stack: details.stack,
          meta: { keyword },
        });
      }
    }
    return all;
  },
  normalize(raw): NormalizedJob | null {
    const r = raw as JoobleJob;
    if (!r?.id) return null;
    return {
      externalId: String(r.id),
      source: "jooble",
      title: r.title,
      company: r.company || "Unknown",
      location: r.location ?? "",
      remote: /remote/i.test(r.location ?? "") || /remote/i.test(r.title),
      workMode: /remote/i.test(r.location ?? "") ? "remote" : "onsite",
      description: stripHtml(r.snippet ?? ""),
      url: r.link,
      postedAt: r.updated ? new Date(r.updated) : new Date(),
      salary: { min: null, max: null, currency: null, period: null },
      category: "",
      tags: [],
      seniority: inferSeniority(r.title),
    };
  },
};
