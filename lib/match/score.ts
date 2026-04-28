import type { JobDoc } from "@/models/job";
import { type ResumeJobProfile, roleFitDetails } from "../jobs/profile";
import { type ParsedResume, ParsedResumeSchema } from "../resume/schema";
import { analyzeLocation } from "./location";
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
  reasons: string[];
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

/** Max age in days before a job is completely excluded from results */
const MAX_AGE_DAYS = 90;

export function score(
  resume: ParsedResume | undefined,
  job: Pick<JobDoc, "extractedSkills" | "seniority" | "location" | "remote" | "postedAt"> & {
    title?: string;
    description?: string;
  },
  prefs: { preferredLocations?: string[]; roleProfile?: ResumeJobProfile } = {},
): MatchResult {
  const safeResume: ParsedResume = resume ?? ParsedResumeSchema.parse({});
  const jsp = safeResume.jobSearchProfile ?? { requiredSkills: [], preferredSkills: [], supportingSkills: [] };
  const sk = safeResume.skills ?? { languages: [], frameworks: [], tools: [], databases: [], cloud: [] };

  const resumeSkills = new Set(
    [
      ...(sk.languages ?? []),
      ...(sk.frameworks ?? []),
      ...(sk.tools ?? []),
      ...(sk.databases ?? []),
      ...(sk.cloud ?? []),
      ...(jsp.requiredSkills ?? []),
      ...(jsp.preferredSkills ?? []),
      ...(jsp.supportingSkills ?? []),
      ...(safeResume.experience ?? []).flatMap((e) => e.skills ?? []),
      ...(safeResume.projects ?? []).flatMap((p) => p.skills ?? []),
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
  const skillCoverage = jobSkills.size === 0 ? 0 : matched.length / jobSkills.size;
  if (jobSkills.size === 0) {
    skillScore = 14;
  } else {
    const absolute = Math.min(matched.length, 8) / 8;
    skillScore = Math.round((skillCoverage * 0.7 + absolute * 0.3) * 42);
  }

  const fit = prefs.roleProfile ? roleFitDetails(prefs.roleProfile, job) : null;
  let titleScore = fit?.roleScore ?? 0;
  if (!fit) {
    // Fallback for legacy data with no stored job-search profile.
    const role = resumeRoleSignal(safeResume);
    const jobTitleTokens = tokenSet(job.title ?? "");
    const titleOverlap = jaccardLite(role.titleTokens, jobTitleTokens);
    let skillInTitle = 0;
    if (jobTitleTokens.size > 0) {
      for (const s of resumeSkills) {
        if (jobTitleTokens.has(s)) {
          skillInTitle = 1;
          break;
        }
      }
    }
    titleScore = Math.min(25, Math.round(titleOverlap * 18 + skillInTitle * 7));
  }

  const seniorityScore =
    safeResume.inferredSeniority === job.seniority
      ? 12
      : isAdjacent(safeResume.inferredSeniority, job.seniority as never)
        ? 7
        : job.seniority === "unknown"
          ? 6
          : 1;

  const location = analyzeLocation(
    safeResume.location,
    job.location,
    Boolean(job.remote),
    prefs.preferredLocations,
  );
  const locationScore = job.remote ? 10 : location.countryMismatch ? 0 : location.matched ? 10 : 4;

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

  // ── Recency scoring (enhanced) ─────────────────────────────────
  // Jobs older than 3 weeks get progressively penalised.
  // Jobs older than MAX_AGE_DAYS are excluded via cap = 0.
  const days = (Date.now() - new Date(job.postedAt).getTime()) / 86_400_000;
  let recencyScore: number;
  let recencyReason = "";
  if (days <= 7) {
    // Fresh jobs: full bonus
    recencyScore = 8;
  } else if (days <= 21) {
    // 1-3 weeks: gentle decay
    recencyScore = Math.max(3, 8 - (days - 7) * 0.36);
  } else if (days <= 45) {
    // 3-6 weeks: steep decay
    recencyScore = Math.max(0, 3 - (days - 21) * 0.13);
    recencyReason = `Posted ${Math.round(days)} days ago — may be filled.`;
  } else if (days <= MAX_AGE_DAYS) {
    // 6 weeks - 3 months: near-zero, likely stale
    recencyScore = 0;
    recencyReason = `Posted ${Math.round(days / 7)} weeks ago — likely unavailable.`;
  } else {
    // Older than 3 months: exclude entirely
    recencyScore = 0;
    recencyReason = `Posted ${Math.round(days / 30)} months ago — very likely unavailable.`;
  }

  const rawScore =
    skillScore + titleScore + seniorityScore + locationScore + expScore + recencyScore;

  let cap = 100;
  if (fit) {
    if (fit.avoidTitleMatch && !fit.strongTitleMatch) cap = Math.min(cap, 29);
    else if (!fit.strongTitleMatch && fit.score < 18) cap = Math.min(cap, 42);
    else if (fit.secondaryOnly) cap = Math.min(cap, 68);
  }
  if (jobSkills.size > 0) {
    if (skillCoverage < 0.25) cap = Math.min(cap, 58);
    else if (skillCoverage < 0.5) cap = Math.min(cap, 74);
    if (missing.length > 0) cap = Math.min(cap, 92);
    if (missing.length >= Math.max(1, matched.length)) cap = Math.min(cap, 78);
  }
  if (fit && !fit.strongTitleMatch && matched.length === 0) cap = Math.min(cap, 49);
  if (location.countryMismatch) cap = Math.min(cap, 62);

  // Age-based caps: aggressively penalise stale listings
  if (days > MAX_AGE_DAYS) cap = 0;
  else if (days > 45) cap = Math.min(cap, 35);
  else if (days > 21) cap = Math.min(cap, 65);

  const finalScore = Math.min(cap, Math.round(rawScore));
  const reasons = [
    recencyReason,
    location.countryMismatch ? location.reason : "",
    fit?.avoidTitleMatch && !fit.strongTitleMatch
      ? "Role family does not match the resume focus."
      : "",
    fit?.secondaryOnly ? "This is a secondary track for this resume." : "",
    jobSkills.size > 0 && skillCoverage < 0.5
      ? `Missing ${missing.length} of ${jobSkills.size} detected job skills.`
      : "",
    matched.length > 0
      ? `Matches ${matched.length} skill${matched.length > 1 ? "s" : ""}: ${matched.slice(0, 4).join(", ")}${matched.length > 4 ? "…" : ""}`
      : "",
    days <= 7 ? "Recently posted." : "",
  ].filter(Boolean);

  return {
    score: Math.max(0, Math.min(100, finalScore)),
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
    reasons,
  };
}
