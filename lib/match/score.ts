import { ParsedResumeSchema, type ParsedResume } from "../resume/schema";
import type { JobDoc } from "@/models/job";
import { isAdjacent } from "./seniority";
import { locationsMatch } from "./location";

export interface MatchResult {
  score: number;
  breakdown: {
    skills: number;
    seniority: number;
    location: number;
    experience: number;
    recency: number;
  };
  matchedSkills: string[];
  missingSkills: string[];
}

export function score(
  resume: ParsedResume | undefined,
  job: Pick<JobDoc, "extractedSkills" | "seniority" | "location" | "remote" | "postedAt"> & {
    title?: string;
  },
  prefs: { preferredLocations?: string[] } = {},
): MatchResult {
  const safeResume: ParsedResume = resume ?? ParsedResumeSchema.parse({});

  const resumeSkills = new Set(
    [
      ...safeResume.skills.languages,
      ...safeResume.skills.frameworks,
      ...safeResume.skills.tools,
      ...safeResume.skills.databases,
      ...safeResume.skills.cloud,
    ].map((s) => s.toLowerCase()),
  );
  const jobSkills = new Set((job.extractedSkills ?? []).map((s) => s.toLowerCase()));
  const matched = [...jobSkills].filter((s) => resumeSkills.has(s));
  const missing = [...jobSkills].filter((s) => !resumeSkills.has(s));
  const skillScore = jobSkills.size === 0 ? 30 : (matched.length / jobSkills.size) * 50;

  const seniorityScore =
    safeResume.inferredSeniority === job.seniority
      ? 20
      : isAdjacent(safeResume.inferredSeniority, job.seniority as never)
        ? 12
        : 4;

  const locationScore = job.remote
    ? 15
    : locationsMatch(safeResume.location, job.location, prefs.preferredLocations)
      ? 15
      : 4;

  const targetYears = job.seniority === "junior" ? 1 : job.seniority === "mid" ? 4 : job.seniority === "senior" ? 7 : 10;
  const diff = Math.abs(safeResume.totalYearsExperience - targetYears);
  const expScore = Math.max(2, 10 - diff * 1.5);

  const days = (Date.now() - new Date(job.postedAt).getTime()) / 86_400_000;
  const recencyScore = Math.max(0, 5 - days * 0.1);

  return {
    score: Math.round(skillScore + seniorityScore + locationScore + expScore + recencyScore),
    breakdown: {
      skills: Math.round(skillScore),
      seniority: Math.round(seniorityScore),
      location: Math.round(locationScore),
      experience: Math.round(expScore),
      recency: Math.round(recencyScore),
    },
    matchedSkills: matched,
    missingSkills: missing,
  };
}
