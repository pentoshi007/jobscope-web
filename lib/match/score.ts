import type { JobDoc } from "@/models/job";
import { type ResumeJobProfile, roleFitScore } from "../jobs/profile";
import { type ParsedResume, ParsedResumeSchema } from "../resume/schema";
import { locationsMatch } from "./location";
import { isAdjacent } from "./seniority";

export interface MatchResult {
  score: number;
  breakdown: {
    skills: number;
    title: number;
    seniority: number;
    location: number;
    experience: number;
    recency: number;
  };
  matchedSkills: string[];
  missingSkills: string[];
}

const STOP = new Set([
  "and",
  "or",
  "the",
  "a",
  "an",
  "of",
  "for",
  "to",
  "with",
  "in",
  "on",
  "at",
  "by",
  "engineer",
  "engineering",
  "developer",
  "specialist",
  "ii",
  "iii",
  "iv",
  "i",
  "sr",
  "jr",
  "senior",
  "junior",
  "staff",
  "principal",
  "lead",
  "mid",
  "level",
  "remote",
  "hybrid",
  "onsite",
]);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9+#./ -]/g, " ")
    .split(/[\s/-]+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
}

function tokenSet(s: string): Set<string> {
  return new Set(tokens(s));
}

function jaccardLite(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  // Coverage of the smaller set is more meaningful here than full Jaccard:
  // a candidate's "frontend" titles should match a job's "frontend engineer"
  // even though the title has extra words.
  return inter / Math.min(a.size, b.size);
}

function resumeRoleSignal(resume: ParsedResume): { titleTokens: Set<string>; raw: string[] } {
  const titles: string[] = [];
  if (resume.headline) titles.push(resume.headline);
  for (const e of resume.experience.slice(0, 5)) if (e.role) titles.push(e.role);
  const merged = titles.join(" ");
  return { titleTokens: tokenSet(merged), raw: titles };
}

export function score(
  resume: ParsedResume | undefined,
  job: Pick<JobDoc, "extractedSkills" | "seniority" | "location" | "remote" | "postedAt"> & {
    title?: string;
    description?: string;
  },
  prefs: { preferredLocations?: string[]; roleProfile?: ResumeJobProfile } = {},
): MatchResult {
  const safeResume: ParsedResume = resume ?? ParsedResumeSchema.parse({});

  const resumeSkills = new Set(
    [
      ...safeResume.skills.languages,
      ...safeResume.skills.frameworks,
      ...safeResume.skills.tools,
      ...safeResume.skills.databases,
      ...safeResume.skills.cloud,
      ...safeResume.experience.flatMap((e) => e.skills ?? []),
      ...safeResume.projects.flatMap((p) => p.skills ?? []),
    ]
      .map((s) => s.toLowerCase().trim())
      .filter(Boolean),
  );

  const jobSkills = new Set(
    (job.extractedSkills ?? []).map((s) => s.toLowerCase().trim()).filter(Boolean),
  );
  const matched = [...jobSkills].filter((s) => resumeSkills.has(s));
  const missing = [...jobSkills].filter((s) => !resumeSkills.has(s));

  // Skills: weight matched count, but require a baseline of overlap to score high.
  // If job has no extracted skills, fall back to a moderate score so it isn't penalised to zero.
  let skillScore: number;
  if (jobSkills.size === 0) {
    skillScore = 18;
  } else {
    const coverage = matched.length / jobSkills.size;
    const absolute = Math.min(matched.length, 6) / 6;
    skillScore = Math.round((coverage * 0.65 + absolute * 0.35) * 40);
  }

  // Title relevance: compare resume's recent role titles against the job title.
  const role = resumeRoleSignal(safeResume);
  const jobTitleTokens = tokenSet(job.title ?? "");
  const titleOverlap = jaccardLite(role.titleTokens, jobTitleTokens);
  // Bonus if any resume skill appears in job title (e.g. "React Engineer" + resume has react).
  let skillInTitle = 0;
  if (jobTitleTokens.size > 0) {
    for (const s of resumeSkills) {
      if (jobTitleTokens.has(s)) {
        skillInTitle = 1;
        break;
      }
    }
  }
  const titleScore = Math.round(titleOverlap * 18 + skillInTitle * 7);

  const seniorityScore =
    safeResume.inferredSeniority === job.seniority
      ? 12
      : isAdjacent(safeResume.inferredSeniority, job.seniority as never)
        ? 7
        : job.seniority === "unknown"
          ? 6
          : 1;

  const locationScore = job.remote
    ? 10
    : locationsMatch(safeResume.location, job.location, prefs.preferredLocations)
      ? 10
      : 2;

  const targetYears =
    job.seniority === "junior"
      ? 1
      : job.seniority === "mid"
        ? 4
        : job.seniority === "senior"
          ? 7
          : job.seniority === "staff"
            ? 10
            : safeResume.totalYearsExperience;
  const diff = Math.abs(safeResume.totalYearsExperience - targetYears);
  const expScore = Math.max(1, 8 - diff * 1.2);

  const days = (Date.now() - new Date(job.postedAt).getTime()) / 86_400_000;
  const recencyScore = Math.max(0, 5 - days * 0.15);
  const fitScore = prefs.roleProfile ? roleFitScore(prefs.roleProfile, job) : 0;
  const rawScore =
    skillScore + titleScore + seniorityScore + locationScore + expScore + recencyScore + fitScore;
  const finalScore = fitScore < 0 ? Math.min(29, Math.round(rawScore)) : Math.round(rawScore);

  return {
    score: Math.max(0, finalScore),
    breakdown: {
      skills: Math.round(skillScore),
      title: Math.round(titleScore),
      seniority: Math.round(seniorityScore),
      location: Math.round(locationScore),
      experience: Math.round(expScore),
      recency: Math.round(recencyScore),
    },
    matchedSkills: matched,
    missingSkills: missing,
  };
}
