import { env } from "../../env";
import { inferSeniority, type JobAdapter, type NormalizedJob, stripHtml } from "../types";

interface USAJob {
  MatchedObjectId: string;
  MatchedObjectDescriptor: {
    PositionTitle: string;
    OrganizationName: string;
    PositionURI: string;
    PositionLocationDisplay: string;
    PublicationStartDate: string;
    ApplicationCloseDate: string;
    UserArea: { Details: { JobSummary?: string } };
    PositionRemuneration: {
      MinimumRange: string;
      MaximumRange: string;
      RateIntervalCode: string;
    }[];
  };
}

export const usajobsAdapter: JobAdapter = {
  source: "usajobs",
  async fetch() {
    const apiKey = env.USAJOBS_API_KEY;
    const userAgent = env.USAJOBS_USER_AGENT;
    if (!apiKey || !userAgent) {
      console.info("[cron] usajobs skipped — USAJOBS_API_KEY/USAJOBS_USER_AGENT not set");
      return [];
    }
    const r = await fetch(
      "https://data.usajobs.gov/api/search?Keyword=engineer&ResultsPerPage=200",
      {
        headers: {
          Host: "data.usajobs.gov",
          "User-Agent": userAgent,
          "Authorization-Key": apiKey,
        },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (r.status === 401 || r.status === 403) {
      console.warn("[cron] usajobs auth rejected — check USAJOBS_API_KEY/USAJOBS_USER_AGENT");
      return [];
    }
    if (!r.ok) throw new Error(`USAJobs ${r.status}`);
    const j = (await r.json()) as { SearchResult: { SearchResultItems: USAJob[] } };
    return j.SearchResult?.SearchResultItems ?? [];
  },
  normalize(raw): NormalizedJob | null {
    const r = raw as USAJob;
    const d = r.MatchedObjectDescriptor;
    if (!d) return null;
    const remunerations = d.PositionRemuneration?.[0];
    const period =
      remunerations?.RateIntervalCode === "Per Hour"
        ? ("hour" as const)
        : remunerations?.RateIntervalCode === "Per Year"
          ? ("year" as const)
          : null;
    return {
      externalId: r.MatchedObjectId,
      source: "usajobs",
      title: d.PositionTitle,
      company: d.OrganizationName,
      location: d.PositionLocationDisplay,
      remote: /telework|remote/i.test(d.PositionLocationDisplay),
      workMode: "onsite",
      description: stripHtml(d.UserArea?.Details?.JobSummary ?? ""),
      url: d.PositionURI,
      postedAt: new Date(d.PublicationStartDate),
      expiresAt: d.ApplicationCloseDate ? new Date(d.ApplicationCloseDate) : undefined,
      salary: {
        min: remunerations ? Number(remunerations.MinimumRange) : null,
        max: remunerations ? Number(remunerations.MaximumRange) : null,
        currency: "USD",
        period,
      },
      category: "",
      tags: [],
      seniority: inferSeniority(d.PositionTitle),
    };
  },
};
