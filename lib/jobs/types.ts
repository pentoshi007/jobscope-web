export type Seniority = "junior" | "mid" | "senior" | "staff" | "unknown";
export type WorkMode = "remote" | "hybrid" | "onsite" | "unknown";

export interface NormalizedJob {
  externalId: string;
  source: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  workMode: WorkMode;
  description: string;
  url: string;
  postedAt: Date;
  expiresAt?: Date;
  salary: {
    min: number | null;
    max: number | null;
    currency: string | null;
    period: "year" | "month" | "hour" | null;
  };
  category: string;
  tags: string[];
  seniority: Seniority;
}

export interface JobAdapter {
  source: string;
  fetch: () => Promise<unknown[]>;
  normalize: (raw: unknown) => NormalizedJob | null;
}

export function inferSeniority(text: string): Seniority {
  const t = text.toLowerCase();
  if (/staff|principal|distinguished/.test(t)) return "staff";
  if (/senior|sr\.|lead/.test(t)) return "senior";
  if (/junior|jr\.|entry|intern|graduate/.test(t)) return "junior";
  if (/mid[- ]?level|intermediate/.test(t)) return "mid";
  return "unknown";
}

export function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}
