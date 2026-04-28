import { createHash } from "node:crypto";

export function dedupeHash(title: string, company: string, location: string, url = ""): string {
  const canonicalUrl = url.replace(/[?#].*$/, "");
  const key = `${title}|${company}|${location}|${canonicalUrl}`
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return createHash("sha256").update(key).digest("hex");
}
