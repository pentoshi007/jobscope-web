import { type JobAdapter, type NormalizedJob, inferSeniority, stripHtml } from "../types";

interface MuseJob {
  id: number;
  name: string;
  contents: string;
  publication_date: string;
  refs: { landing_page: string };
  company: { name: string };
  locations: { name: string }[];
  categories: { name: string }[];
  levels: { name: string }[];
  tags: { name: string }[];
}

export const museAdapter: JobAdapter = {
  source: "muse",
  async fetch() {
    const all: MuseJob[] = [];
    for (let page = 1; page <= 3; page++) {
      const r = await fetch(`https://www.themuse.com/api/public/jobs?page=${page}`, {
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) break;
      const j = (await r.json()) as { results: MuseJob[] };
      if (!j.results?.length) break;
      all.push(...j.results);
    }
    return all;
  },
  normalize(raw): NormalizedJob | null {
    const r = raw as MuseJob;
    if (!r?.id) return null;
    const loc = r.locations?.[0]?.name ?? "";
    const remote = /flexible|remote/i.test(loc);
    return {
      externalId: String(r.id),
      source: "muse",
      title: r.name,
      company: r.company?.name ?? "",
      location: loc,
      remote,
      workMode: remote ? "remote" : "onsite",
      description: stripHtml(r.contents ?? ""),
      url: r.refs?.landing_page ?? "",
      postedAt: new Date(r.publication_date),
      salary: { min: null, max: null, currency: null, period: null },
      category: r.categories?.[0]?.name ?? "",
      tags: (r.tags ?? []).map((t) => t.name),
      seniority: inferSeniority(`${r.name} ${r.levels?.[0]?.name ?? ""}`),
    };
  },
};
