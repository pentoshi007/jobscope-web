import { type JobAdapter, type NormalizedJob, inferSeniority, stripHtml } from "../types";

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  category: string;
  job_type: string;
  publication_date: string;
  candidate_required_location: string;
  salary: string;
  description: string;
  tags: string[];
}

export const remotiveAdapter: JobAdapter = {
  source: "remotive",
  async fetch() {
    const r = await fetch("https://remotive.com/api/remote-jobs", {
      headers: { "User-Agent": "JobScope/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error(`Remotive ${r.status}`);
    const j = (await r.json()) as { jobs: RemotiveJob[] };
    return j.jobs ?? [];
  },
  normalize(raw): NormalizedJob | null {
    const r = raw as RemotiveJob;
    if (!r?.id || !r.title || !r.url) return null;
    return {
      externalId: String(r.id),
      source: "remotive",
      title: r.title,
      company: r.company_name,
      location: r.candidate_required_location || "Remote",
      remote: true,
      workMode: "remote",
      description: stripHtml(r.description ?? ""),
      url: r.url,
      postedAt: new Date(r.publication_date),
      salary: { min: null, max: null, currency: null, period: null },
      category: r.category ?? "",
      tags: r.tags ?? [],
      seniority: inferSeniority(r.title),
    };
  },
};
