import type { ParsedResume } from "./schema";

const ACTION_VERBS = [
  "led",
  "built",
  "shipped",
  "designed",
  "implemented",
  "improved",
  "reduced",
  "increased",
  "launched",
  "owned",
  "architected",
  "migrated",
  "optimized",
  "delivered",
];

export function atsScore(parsed: ParsedResume, rawText: string) {
  const breakdown = {
    contact: 0,
    skills: 0,
    actionVerbs: 0,
    structure: 0,
    length: 0,
  };

  if (parsed.email) breakdown.contact += 10;
  if (parsed.phone) breakdown.contact += 5;
  if (parsed.location) breakdown.contact += 5;

  const totalSkills =
    parsed.skills.languages.length +
    parsed.skills.frameworks.length +
    parsed.skills.tools.length +
    parsed.skills.databases.length +
    parsed.skills.cloud.length;
  breakdown.skills = Math.min(25, totalSkills * 1.5);

  const lower = rawText.toLowerCase();
  const verbHits = ACTION_VERBS.filter((v) => lower.includes(v)).length;
  breakdown.actionVerbs = Math.min(20, verbHits * 2);

  if (parsed.experience.length >= 2) breakdown.structure += 10;
  if (parsed.education.length >= 1) breakdown.structure += 5;
  if (parsed.summary.length > 50) breakdown.structure += 5;

  const wc = rawText.split(/\s+/).length;
  if (wc >= 250 && wc <= 1200) breakdown.length = 15;
  else if (wc >= 150) breakdown.length = 8;

  const total =
    breakdown.contact +
    breakdown.skills +
    breakdown.actionVerbs +
    breakdown.structure +
    breakdown.length;

  return { score: Math.min(100, Math.round(total)), breakdown };
}
