import { env } from "../../env";
import { type JobAdapter, type NormalizedJob, inferSeniority, stripHtml } from "../types";

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
        console.error("Jooble failed", e);
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
