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
- If the resume spans multiple tracks, rank them. Put the strongest track in primaryRole and targetTitles. Put credible but secondary tracks only in secondaryTitles.
- Put roles that would distract job search in avoidTitles. Do not put adjacent variants of the primary role in avoidTitles; for example, if primaryRole is Full-Stack Developer, frontend/backend/web/software roles are adjacent, not filtered out.
- requiredSkills must be evidenced by the resume and important for the primaryRole. Put less certain or secondary-track skills in preferredSkills/supportingSkills.
- Build searchQueries as 3 to 5 short phrases that job APIs can search directly. Prefer role/domain phrases over raw skills.
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
  const text = compactText([
    resume.headline,
    resume.summary,
    ...resume.experience.slice(0, 4).flatMap((e) => [e.role, e.description]),
    ...resume.projects.slice(0, 4).flatMap((p) => [p.name, p.description]),
    ...allResumeSkills(resume),
    ...resume.certifications.map((c) => c.name),
  ]);

  const recentTitles = unique(
    [resume.headline, ...resume.experience.slice(0, 3).map((e) => e.role)]
      .map(cleanTitle)
      .filter(Boolean),
  );

  const cyber = countHits(
    text,
    /\b(cyber ?security|information security|soc|siem|threat|incident response|vulnerability|penetration|pentest|owasp|burp|nmap|wireshark|metasploit|splunk|rbac|iam|security analyst)\b/g,
  );
  const web = countHits(
    text,
    /\b(full stack|frontend|front end|backend|back end|react|node\.?js|next\.?js|django|flask|web developer)\b/g,
  );
  const data = countHits(
    text,
    /\b(data analyst|data scientist|analytics|sql|tableau|power bi|pandas|numpy|machine learning)\b/g,
  );
  const finance = countHits(
    text,
    /\b(finance|financial|accounting|audit|tax|valuation|excel|quickbooks|bookkeeping)\b/g,
  );
  const video = countHits(
    text,
    /\b(video editor|video editing|premiere pro|after effects|davinci|final cut|motion graphics|color grading)\b/g,
  );

  let primaryRole = recentTitles[0] || "General Professional";
  let targetTitles = recentTitles.slice(0, 4);
  let secondaryTitles: string[] = [];
  let avoidTitles: string[] = [];
  let requiredSkills = topSkills(resume, 6);
  let preferredSkills = topSkills(resume, 12).slice(6);

  if (cyber >= Math.max(2, web)) {
    primaryRole = titleCase(
      recentTitles.find((title) => /security|cyber|soc/i.test(title)) || "Cybersecurity Analyst",
    );
    targetTitles = unique([
      primaryRole,
      "Cybersecurity Analyst",
      "Security Analyst",
      "SOC Analyst",
      "Information Security Analyst",
      "Application Security Analyst",
    ]);
    if (web > 0) {
      secondaryTitles = ["Web Developer", "Full Stack Developer"];
      avoidTitles = [
        "Full Stack Developer",
        "Frontend Developer",
        "Backend Developer",
        "Web Developer",
      ];
    }
    requiredSkills = unique([
      "cybersecurity",
      "security analysis",
      "vulnerability assessment",
      "incident response",
      "network security",
      ...topSkills(resume, 6),
    ]).slice(0, 8);
    preferredSkills = unique([
      "python",
      "linux",
      "bash",
      "sql",
      "iam",
      "rbac",
      ...topSkills(resume, 12),
    ]).slice(0, 10);
  } else if (data >= 3) {
    primaryRole = titleCase(
      recentTitles.find((title) => /data|analytics/i.test(title)) || "Data Analyst",
    );
    targetTitles = unique([primaryRole, "Data Analyst", "Business Analyst", "Analytics Analyst"]);
  } else if (finance >= 3) {
    primaryRole = titleCase(
      recentTitles.find((title) => /financ|account|audit/i.test(title)) || "Financial Analyst",
    );
    targetTitles = unique([
      primaryRole,
      "Financial Analyst",
      "Finance Analyst",
      "Accounting Analyst",
    ]);
  } else if (video >= 2) {
    primaryRole = titleCase(
      recentTitles.find((title) => /video|editor|motion/i.test(title)) || "Video Editor",
    );
    targetTitles = unique([
      primaryRole,
      "Video Editor",
      "Motion Graphics Editor",
      "Content Editor",
    ]);
  } else if (web >= 2) {
    primaryRole = titleCase(
      recentTitles.find((title) => /full|frontend|backend|web|developer|engineer/i.test(title)) ||
        "Full Stack Developer",
    );
    targetTitles = unique([primaryRole, ...recentTitles, "Software Engineer"]).slice(0, 6);
  }

  const searchQueries = unique(targetTitles.slice(0, 5)).map(titleCase);
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
        priority: 40,
        reason: "Mentioned as a secondary capability.",
      })),
    ],
    targetTitles: targetTitles.map(titleCase),
    secondaryTitles: secondaryTitles.map(titleCase),
    avoidTitles: avoidTitles.map(titleCase),
    requiredSkills,
    preferredSkills,
    supportingSkills: topSkills(resume, 18).slice(12),
    searchQueries,
    keywords: unique([...targetTitles, ...requiredSkills, ...preferredSkills]).slice(0, 18),
    negativeKeywords: avoidTitles,
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
        : targetTitles),
      primaryRole,
    ])
      .filter((query) => compatibleTitle(primaryRole, query))
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

function countHits(text: string, re: RegExp) {
  return text.match(re)?.length ?? 0;
}

function compactText(values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" ").toLowerCase();
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

  const primarySoftware = p.some((token) => SOFTWARE_FAMILY.has(token));
  const candidateSoftware = c.some((token) => SOFTWARE_FAMILY.has(token));
  if (primarySoftware && candidateSoftware) return true;

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
  "analyst",
  "manager",
  "designer",
  "editor",
  "consultant",
  "specialist",
  "administrator",
  "architect",
  "accountant",
  "associate",
]);

const SOFTWARE_FAMILY = new Set([
  "software",
  "developer",
  "engineer",
  "programmer",
  "full",
  "stack",
  "frontend",
  "backend",
  "front",
  "back",
  "web",
  "react",
  "node",
  "javascript",
  "typescript",
]);

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
