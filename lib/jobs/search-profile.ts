import { geminiJson } from "@/lib/llm/gemini";
import { groqJson } from "@/lib/llm/groq";
import {
  type JobSearchProfile,
  JobSearchProfileSchema,
  type ParsedResume,
} from "@/lib/resume/schema";

const MAX_RAW_TEXT = 9000;
const MAX_SUMMARY_CHARS = 1200;

const PROFILE_SCHEMA_DOC = `{
  "primaryRole": string,
  "profileSummary": string,
  "roleFamilies": [{ "label": string, "priority": number, "reason": string }],
  "targetTitles": string[],
  "secondaryTitles": string[],
  "avoidTitles": string[],
  "requiredSkills": string[],
  "preferredSkills": string[],
  "supportingSkills": string[],
  "searchQueries": string[],
  "keywords": string[],
  "negativeKeywords": string[]
}`;

const PROFILE_SYSTEM = `You build concise job-search profiles from parsed resumes.
Output ONLY valid JSON matching this schema:
${PROFILE_SCHEMA_DOC}

Rules:
- Infer the candidate's dominant job track from headline, summary, recent roles, years of experience, certifications, and repeated project/work evidence.
- Skills that appear only once, old work, side projects, or "also familiar with" items are supporting, not primary.
- targetTitles must all belong to the primaryRole family. Do not put internships or unrelated secondary tracks in targetTitles unless the primaryRole itself is an internship track.
- If the resume spans multiple tracks, rank them. Put the strongest track in primaryRole and targetTitles.
- Put credible adjacent or transferable tracks in secondaryTitles when there is evidence from role history, projects, certifications, tools, portfolio work, or repeated domain skills. Secondary titles should be eligible for search, but less important than targetTitles.
- Use roleFamilies to express strength across tracks: primary family near 90-100, credible adjacent tracks around 35-75, weak/background-only tracks below 35.
- Put roles that would distract job search in avoidTitles. Do not put adjacent variants, component roles, specializations, or evidenced secondary tracks in avoidTitles.
- requiredSkills must be evidenced by the resume and important for the primaryRole. Put less certain or secondary-track skills in preferredSkills/supportingSkills.
- Build searchQueries as 3 to 6 short phrases that job APIs can search directly. Include the strongest target roles first, then one or two credible secondary-role searches.
- keywords should support filtering and ranking. Include domain-specific tools and skills, not generic words.
- negativeKeywords should include terms that commonly cause bad matches for the primaryRole.
- Work for any profession, including cybersecurity, finance, design, video editing, sales, healthcare, legal, education, and software.
- Do not invent credentials or seniority.`;

export async function buildAiJobSearchProfile(
  resume: ParsedResume,
  rawText = "",
): Promise<JobSearchProfile> {
  const compact = compactResume(resume, rawText);
  const prompt = `${PROFILE_SYSTEM}

Parsed resume:
${JSON.stringify(compact)}`;

  try {
    return normalizeProfile(await geminiJson<unknown>(prompt), "ai", resume);
  } catch {
    try {
      return normalizeProfile(
        await groqJson<unknown>(PROFILE_SYSTEM, `Parsed resume:\n${JSON.stringify(compact)}`),
        "ai",
        resume,
      );
    } catch {
      return buildHeuristicJobSearchProfile(resume);
    }
  }
}

export function buildHeuristicJobSearchProfile(resume: ParsedResume): JobSearchProfile {
  const recentTitles = unique(
    [resume.headline, ...resume.experience.slice(0, 3).map((e) => e.role)]
      .map(cleanTitle)
      .filter(Boolean),
  );
  const olderTitles = unique(
    resume.experience
      .slice(3, 8)
      .map((e) => cleanTitle(e.role))
      .filter(Boolean),
  );
  const primaryRole = recentTitles[0] || cleanTitle(resume.headline) || "General Professional";
  const targetTitles = unique([
    primaryRole,
    ...recentTitles.filter((title) => compatibleTitle(primaryRole, title)),
  ]).slice(0, 6);
  const top = topSkills(resume, 18);
  const skillDerivedTitles = top
    .slice(0, 5)
    .map((skill) => secondaryTitleFromSkill(skill, primaryRole))
    .filter(Boolean);
  const secondaryTitles = unique([
    ...recentTitles.filter((title) => !compatibleTitle(primaryRole, title)),
    ...olderTitles.filter((title) => !compatibleTitle(primaryRole, title)),
    ...skillDerivedTitles,
  ])
    .filter((title) => normalizeComparable(title) !== normalizeComparable(primaryRole))
    .slice(0, 8);
  const requiredSkills = top.slice(0, 8);
  const preferredSkills = top.slice(8, 16);
  const searchQueries = unique([
    primaryRole,
    ...targetTitles.slice(1, 3),
    ...secondaryTitles.slice(0, 2),
  ])
    .slice(0, 6)
    .map(titleCase);
  const profile = {
    primaryRole: titleCase(primaryRole),
    profileSummary: summarize(resume),
    roleFamilies: [
      {
        label: titleCase(primaryRole),
        priority: 100,
        reason: "Strongest signal from headline, recent roles, and repeated resume evidence.",
      },
      ...secondaryTitles.slice(0, 2).map((title) => ({
        label: titleCase(title),
        priority: 45,
        reason: "Evidenced as an adjacent or secondary capability.",
      })),
    ],
    targetTitles: targetTitles.map(titleCase),
    secondaryTitles: secondaryTitles.map(titleCase),
    avoidTitles: [],
    requiredSkills,
    preferredSkills,
    supportingSkills: top.slice(16),
    searchQueries,
    keywords: unique([
      ...targetTitles,
      ...secondaryTitles,
      ...requiredSkills,
      ...preferredSkills,
    ]).slice(0, 18),
    negativeKeywords: [],
    source: "heuristic" as const,
    builtAt: new Date().toISOString(),
  };

  return JobSearchProfileSchema.parse(profile);
}

function compactResume(resume: ParsedResume, rawText: string) {
  return {
    headline: resume.headline,
    summary: resume.summary.slice(0, MAX_SUMMARY_CHARS),
    years: resume.totalYearsExperience,
    seniority: resume.inferredSeniority,
    skills: resume.skills,
    recentExperience: resume.experience.slice(0, 5).map((e) => ({
      role: e.role,
      company: e.company,
      description: e.description.slice(0, 1000),
      skills: e.skills,
      startDate: e.startDate,
      endDate: e.endDate,
    })),
    projects: resume.projects.slice(0, 5).map((p) => ({
      name: p.name,
      description: p.description.slice(0, 700),
      skills: p.skills,
    })),
    certifications: resume.certifications.slice(0, 8),
    rawTextSample: rawText.slice(0, MAX_RAW_TEXT),
  };
}

function normalizeProfile(raw: unknown, source: JobSearchProfile["source"], resume: ParsedResume) {
  const parsed = JobSearchProfileSchema.safeParse(raw);
  if (!parsed.success) return buildHeuristicJobSearchProfile(resume);

  const fallback = buildHeuristicJobSearchProfile(resume);
  const profile = parsed.data;
  const rawTargetTitles = cleanList(profile.targetTitles);
  const primaryRole = cleanTitle(profile.primaryRole) || rawTargetTitles[0] || fallback.primaryRole;
  const targetTitles = unique([primaryRole, ...rawTargetTitles, ...fallback.targetTitles])
    .filter((title) => compatibleTitle(primaryRole, title))
    .slice(0, 8);
  const incompatibleTargets = rawTargetTitles.filter(
    (title) => !compatibleTitle(primaryRole, title),
  );
  const secondaryTitles = unique([
    ...cleanList(profile.secondaryTitles),
    ...incompatibleTargets,
  ]).filter((title) => normalizeComparable(title) !== normalizeComparable(primaryRole));
  const avoidTitles = cleanList(profile.avoidTitles).filter(
    (title) => !adjacentToPrimary(primaryRole, title, targetTitles),
  );
  const evidence = resumeEvidenceText(resume);
  const requiredSkills = evidenceBacked(
    cleanList(profile.requiredSkills),
    evidence,
    fallback.requiredSkills,
  );
  const preferredSkills = unique([
    ...evidenceBacked(cleanList(profile.preferredSkills), evidence, fallback.preferredSkills),
    ...cleanList(profile.requiredSkills).filter((skill) => !requiredSkills.includes(skill)),
  ]);

  return JobSearchProfileSchema.parse({
    ...profile,
    primaryRole: titleCase(primaryRole),
    profileSummary: profile.profileSummary.trim() || fallback.profileSummary,
    roleFamilies: profile.roleFamilies
      .map((family) => ({
        label: titleCase(cleanTitle(family.label)),
        priority: Math.max(0, Math.min(100, Math.round(family.priority))),
        reason: family.reason.trim().slice(0, 180),
      }))
      .filter((family) => family.label)
      .slice(0, 5),
    targetTitles: targetTitles.map(titleCase),
    secondaryTitles: secondaryTitles.slice(0, 6).map(titleCase),
    avoidTitles: avoidTitles.slice(0, 8).map(titleCase),
    requiredSkills: unique([...requiredSkills, ...fallback.requiredSkills]).slice(0, 12),
    preferredSkills: unique([...preferredSkills, ...fallback.preferredSkills]).slice(0, 14),
    supportingSkills: cleanList(profile.supportingSkills).slice(0, 14),
    searchQueries: unique([
      ...(cleanList(profile.searchQueries).length
        ? cleanList(profile.searchQueries)
        : [...targetTitles, ...secondaryTitles.slice(0, 2)]),
      primaryRole,
      ...secondaryTitles.slice(0, 2),
    ])
      .filter((query) => !avoidTitles.some((title) => compatibleTitle(title, query)))
      .slice(0, 5)
      .map(titleCase),
    keywords: unique([...cleanList(profile.keywords), ...requiredSkills, ...preferredSkills]).slice(
      0,
      20,
    ),
    negativeKeywords: cleanList(profile.negativeKeywords).slice(0, 12),
    source,
    builtAt: new Date().toISOString(),
  });
}

function summarize(resume: ParsedResume) {
  const pieces = [resume.headline, resume.summary].filter(Boolean);
  return pieces.join(" ").slice(0, 240);
}

function allResumeSkills(resume: ParsedResume) {
  return [
    ...resume.skills.languages,
    ...resume.skills.frameworks,
    ...resume.skills.tools,
    ...resume.skills.databases,
    ...resume.skills.cloud,
    ...resume.experience.flatMap((e) => e.skills ?? []),
    ...resume.projects.flatMap((p) => p.skills ?? []),
  ];
}

function topSkills(resume: ParsedResume, limit: number) {
  const counts = new Map<string, number>();
  for (const skill of allResumeSkills(resume)) {
    const normalized = normalizeSkill(skill);
    if (!normalized || looksLikeRole(normalized)) continue;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([skill]) => skill)
    .slice(0, limit);
}

function cleanList(values: Array<string | null | undefined>) {
  return unique(values.map((value) => cleanTitle(value ?? "")).filter(Boolean));
}

function cleanTitle(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/^[^a-z0-9]+|[^a-z0-9+#.)]+$/gi, "")
    .trim();
}

function compatibleTitle(primary: string, candidate: string) {
  const p = meaningfulTokens(primary);
  const c = meaningfulTokens(candidate);
  if (normalizeComparable(primary) === normalizeComparable(candidate)) return true;
  if (p.length === 0 || c.length === 0) return false;

  const overlap = c.filter((token) => p.includes(token)).length;
  if (overlap / Math.min(p.length, c.length) >= 0.45) return true;

  if (roleHeadsCompatible(roleHead(primary), roleHead(candidate))) return true;

  return false;
}

function adjacentToPrimary(primary: string, candidate: string, targetTitles: string[]) {
  if (compatibleTitle(primary, candidate)) return true;
  const candidateHead = roleHead(candidate);
  if (candidateHead && candidateHead === roleHead(primary)) return true;
  return targetTitles.some((title) => compatibleTitle(title, candidate));
}

const ROLE_HEADS = new Set([
  "developer",
  "engineer",
  "programmer",
  "analyst",
  "manager",
  "designer",
  "editor",
  "artist",
  "producer",
  "consultant",
  "specialist",
  "administrator",
  "architect",
  "accountant",
  "associate",
]);

const ROLE_HEAD_GROUPS = [
  new Set(["developer", "engineer", "programmer", "architect"]),
  new Set(["analyst", "specialist", "consultant", "associate"]),
  new Set(["designer", "editor", "artist", "producer"]),
];

const TITLE_STOP = new Set([
  "junior",
  "jr",
  "senior",
  "sr",
  "lead",
  "staff",
  "principal",
  "intern",
  "internship",
  "trainee",
  "entry",
  "level",
]);

function meaningfulTokens(value: string) {
  return normalizeComparable(value)
    .split(" ")
    .filter((token) => token.length > 1 && !TITLE_STOP.has(token));
}

function roleHead(value: string) {
  return meaningfulTokens(value).find((token) => ROLE_HEADS.has(token)) ?? "";
}

function roleHeadsCompatible(a: string, b: string) {
  if (!a || !b) return false;
  if (a === b) return true;
  return ROLE_HEAD_GROUPS.some((group) => group.has(a) && group.has(b));
}

function normalizeComparable(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function evidenceBacked(values: string[], evidence: string, fallback: string[]) {
  const fallbackSet = new Set(fallback.map(normalizeComparable));
  return unique(
    values.filter((value) => {
      const normalized = normalizeComparable(value);
      return (
        fallbackSet.has(normalized) || (normalized.length > 1 && evidence.includes(normalized))
      );
    }),
  );
}

function resumeEvidenceText(resume: ParsedResume) {
  return normalizeComparable(
    [
      resume.headline,
      resume.summary,
      ...allResumeSkills(resume),
      ...resume.experience.flatMap((e) => [e.role, e.description, ...(e.skills ?? [])]),
      ...resume.projects.flatMap((p) => [p.name, p.description, ...(p.skills ?? [])]),
      ...resume.certifications.map((c) => c.name),
    ].join(" "),
  );
}

function normalizeSkill(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function looksLikeRole(value: string) {
  return /\b(developer|engineer|analyst|manager|designer|editor|consultant|specialist|administrator|architect)\b/i.test(
    value,
  );
}

function secondaryTitleFromSkill(skill: string, primaryRole: string) {
  const head = roleHead(primaryRole);
  const clean = cleanTitle(skill);
  if (!head || !clean || clean.length < 3 || looksLikeRole(clean)) return "";
  return `${clean} ${head}`;
}

function titleCase(value: string) {
  return value.replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

function unique(values: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const clean = value.trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}
