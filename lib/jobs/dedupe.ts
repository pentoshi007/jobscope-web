import { createHash } from "node:crypto";

export function dedupeHash(title: string, company: string, location: string): string {
  const key = `${title}|${company}|${location}`.toLowerCase().replace(/\s+/g, " ").trim();
  return createHash("sha256").update(key).digest("hex");
}
