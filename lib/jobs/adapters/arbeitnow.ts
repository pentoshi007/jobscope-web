import { type JobAdapter, type NormalizedJob, inferSeniority, stripHtml } from "../types";

interface ArbeitJob {
  slug: string;
  title: string;
  company_name: string;
  location: string;
  remote: boolean;
  description: string;
  url: string;
  created_at: number;
  tags: string[];
  job_types: string[];
}

export const arbeitnowAdapter: JobAdapter = {
  source: "arbeitnow",
  async fetch() {
    const r = await fetch("https://arbeitnow.com/api/job-board-api", {
      headers: { "User-Agent": "JobScope/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error(`Arbeitnow ${r.status}`);
    const j = (await r.json()) as { data: ArbeitJob[] };
    return j.data ?? [];
  },
  normalize(raw): NormalizedJob | null {
    const r = raw as ArbeitJob;
    if (!r?.slug) return null;
    return {
      externalId: r.slug,
      source: "arbeitnow",
      title: r.title,
      company: r.company_name,
      location: r.location || (r.remote ? "Remote" : ""),
      remote: !!r.remote,
      workMode: r.remote ? "remote" : "onsite",
      description: stripHtml(r.description ?? ""),
      url: r.url,
      postedAt: new Date(r.created_at * 1000),
      salary: { min: null, max: null, currency: null, period: null },
      category: r.job_types?.[0] ?? "",
      tags: r.tags ?? [],
      seniority: inferSeniority(r.title),
    };
  },
};
