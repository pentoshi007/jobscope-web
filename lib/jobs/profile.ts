import {
  type JobSearchProfile,
  JobSearchProfileSchema,
  type ParsedResume,
} from "@/lib/resume/schema";

type TermSource = "title" | "skill" | "certification" | "experience" | "project" | "summary";

export interface ProfileTerm {
  term: string;
  weight: number;
  source: TermSource;
}

export interface ResumeJobProfile {
  primaryTitle: string;
  titles: string[];
  secondaryTitles: string[];
  avoidTitles: string[];
  titleTokens: string[];
  avoidTitleTokens: string[];
  terms: ProfileTerm[];
  queryRoles: string[];
  requiredTerms: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  labels: Array<{ label: string; score: number }>;
  source: "ai" | "heuristic" | "derived";
}

export interface RoleFitDetails {
  score: number;
  roleScore: number;
  strongTitleMatch: boolean;
  secondaryOnly: boolean;
  avoidTitleMatch: boolean;
  evidenceCount: number;
}

const STOP = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "based",
  "by",
  "for",
  "from",
  "in",
  "into",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
  "remote",
  "hybrid",
  "onsite",
  "junior",
  "jr",
  "mid",
  "senior",
  "sr",
  "lead",
  "staff",
  "principal",
  "intern",
  "trainee",
  "entry",
  "level",
  "i",
  "ii",
  "iii",
  "iv",
]);

const WEAK_JOB_WORDS = new Set([
  "assistant",
  "associate",
  "consultant",
  "coordinator",
  "developer",
  "engineer",
  "executive",
  "manager",
  "officer",
  "specialist",
  "analyst",
]);

export function buildResumeJobProfile(resumes: ParsedResume[]): ResumeJobProfile {
  const weightedTerms = new Map<string, { weight: number; source: TermSource }>();
  const titleScores = new Map<string, number>();
  const secondaryScores = new Map<string, number>();
  const avoidScores = new Map<string, number>();
  const explicitQueries: string[] = [];
  const requiredSkills: string[] = [];
  const preferredSkills: string[] = [];
  const storedLabels: Array<{ label: string; score: number }> = [];
  let primaryFromProfile = "";
  let source: ResumeJobProfile["source"] = "derived";

  for (const resume of resumes) {
    const stored = safeJobSearchProfile(resume);
    const hasStored = !!(
      stored.primaryRole ||
      stored.targetTitles.length ||
      stored.searchQueries.length ||
      stored.requiredSkills.length
    );

    if (hasStored) {
      source = stored.source;
      primaryFromProfile ||= stored.primaryRole;
      const targetTitles = unique([stored.primaryRole, ...stored.targetTitles]).filter((title) =>
        compatibleTitle(stored.primaryRole, title),
      );
      const secondaryTitles = unique([
        ...stored.secondaryTitles,
        ...stored.targetTitles.filter((title) => !compatibleTitle(stored.primaryRole, title)),
      ]);
      const avoidTitles = stored.avoidTitles.filter(
        (title) => !adjacentToPrimary(stored.primaryRole, title, targetTitles),
      );
      addTitle(titleScores, weightedTerms, stored.primaryRole, 28);
      for (const title of targetTitles) addTitle(titleScores, weightedTerms, title, 22);
      for (const title of secondaryTitles) {
        addSecondaryTitle(secondaryScores, weightedTerms, title, 12);
      }
      for (const title of avoidTitles) addAvoidTitle(avoidScores, title);
      addListTerms(weightedTerms, stored.requiredSkills, 9, "skill");
      addListTerms(weightedTerms, stored.preferredSkills, 5, "skill");
      addListTerms(weightedTerms, stored.supportingSkills, 1.5, "skill");
      requiredSkills.push(...stored.requiredSkills);
      preferredSkills.push(...stored.preferredSkills, ...stored.supportingSkills);
      explicitQueries.push(...stored.searchQueries, stored.primaryRole);
      storedLabels.push(
        ...stored.roleFamilies
          .filter((family) => family.label)
          .map((family) => ({ label: family.label, score: family.priority })),
      );
    }

    addTitle(titleScores, weightedTerms, resume.headline ?? "", hasStored ? 4 : 9);

    (resume.experience ?? []).slice(0, 2).forEach((exp, index) => {
      addTitle(titleScores, weightedTerms, exp.role, hasStored ? 3 : index === 0 ? 10 : 7);
      addTerms(weightedTerms, exp.description ?? "", index === 0 ? 1.4 : 0.9, "experience");
      addListTerms(weightedTerms, exp.skills ?? [], hasStored ? 2 : 5, "skill");
    });

    (resume.experience ?? []).slice(2, 5).forEach((exp) => {
      addTitle(titleScores, weightedTerms, exp.role, hasStored ? 1 : 3);
      addTerms(weightedTerms, exp.description ?? "", 0.6, "experience");
    });

    addTerms(weightedTerms, resume.summary ?? "", hasStored ? 0.8 : 2, "summary");
    const sk = resume.skills ?? { languages: [], frameworks: [], tools: [], databases: [], cloud: [], soft: [] };
    addListTerms(
      weightedTerms,
      [
        ...(sk.languages ?? []),
        ...(sk.frameworks ?? []),
        ...(sk.tools ?? []),
        ...(sk.databases ?? []),
        ...(sk.cloud ?? []),
        ...(sk.soft ?? []),
      ],
      hasStored ? 1.6 : 4,
      "skill",
    );
    addListTerms(
      weightedTerms,
      (resume.certifications ?? []).map((cert) => cert.name),
      hasStored ? 5 : 6,
      "certification",
    );
    for (const project of (resume.projects ?? []).slice(0, 4)) {
      addTerms(
        weightedTerms,
        `${project.name} ${project.description} ${(project.skills ?? []).join(" ")}`,
        hasStored ? 0.7 : 1.2,
        "project",
      );
    }
  }

  const titles = [...titleScores.entries()]
    .filter(([title]) => meaningfulTitle(title))
    .sort((a, b) => b[1] - a[1])
    .map(([title]) => title)
    .slice(0, 8);

  const secondaryTitles = [...secondaryScores.entries()]
    .filter(([title]) => meaningfulTitle(title))
    .sort((a, b) => b[1] - a[1])
    .map(([title]) => title)
    .slice(0, 8);

  const avoidTitles = [...avoidScores.keys()].filter(meaningfulTitle).slice(0, 10);

  const terms = [...weightedTerms.entries()]
    .map(([term, value]) => ({ term, weight: value.weight, source: value.source }))
    .filter(({ term }) => term.length > 1 && !STOP.has(term))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 50);

  const primaryTitle =
    normalizeTitle(primaryFromProfile) || titles[0] || terms[0]?.term || "general";
  const titleTokens = unique(titles.flatMap((title) => tokens(title))).filter(
    (token) => !WEAK_JOB_WORDS.has(token),
  );
  const avoidTitleTokens = unique(avoidTitles.flatMap((title) => tokens(title))).filter(
    (token) => !WEAK_JOB_WORDS.has(token),
  );
  const requiredTerms = unique([
    ...titles.slice(0, 5),
    ...requiredSkills.map(normalize),
    ...terms.filter((term) => term.source === "certification").map((term) => term.term),
  ]).slice(0, 18);
  const queryRoles = unique(explicitQueries.map(normalizeTitle).filter(Boolean)).slice(0, 5);
  const fallbackQueryRoles = unique([
    ...titles.slice(0, 4),
    ...terms
      .filter((term) => term.source === "certification" || term.source === "skill")
      .slice(0, 3)
      .map((term) => term.term),
  ]).slice(0, 5);

  return {
    primaryTitle,
    titles,
    secondaryTitles,
    avoidTitles,
    titleTokens,
    avoidTitleTokens,
    terms,
    queryRoles: queryRoles.length
      ? queryRoles
      : fallbackQueryRoles.length
        ? fallbackQueryRoles
        : [primaryTitle],
    requiredTerms: requiredTerms.length ? requiredTerms : [primaryTitle],
    requiredSkills: unique(requiredSkills.map(normalize).filter(Boolean)).slice(0, 16),
    preferredSkills: unique(preferredSkills.map(normalize).filter(Boolean)).slice(0, 18),
    labels: storedLabels.length ? storedLabels.slice(0, 6) : makeLabels(titles, terms),
    source,
  };
}

export function jobMatchesProfile(
  profile: ResumeJobProfile,
  job: {
    title?: string | null;
    description?: string | null;
    category?: string | null;
    tags?: string[] | null;
    extractedSkills?: string[] | null;
  },
) {
  if (profile.primaryTitle === "general" && profile.terms.length === 0) return true;
  const fit = roleFitDetails(profile, job);
  if (fit.avoidTitleMatch && !fit.strongTitleMatch) return false;
  if (fit.strongTitleMatch) return fit.score >= 12;
  if (fit.secondaryOnly) return fit.score >= 18 && fit.evidenceCount >= 1;
  return fit.score >= 18 && fit.evidenceCount >= 2;
}

export function roleFitScore(
  profile: ResumeJobProfile,
  job: {
    title?: string | null;
    description?: string | null;
    category?: string | null;
    tags?: string[] | null;
    extractedSkills?: string[] | null;
  },
) {
  return roleFitDetails(profile, job).score;
}

export function roleFitDetails(
  profile: ResumeJobProfile,
  job: {
    title?: string | null;
    description?: string | null;
    category?: string | null;
    tags?: string[] | null;
    extractedSkills?: string[] | null;
  },
): RoleFitDetails {
  const title = normalize(job.title ?? "");
  const titleTokens = new Set(tokens(title));
  const body = normalize(
    [
      job.category ?? "",
      (job.tags ?? []).join(" "),
      (job.extractedSkills ?? []).join(" "),
      (job.description ?? "").slice(0, 1800),
    ].join(" "),
  );

  let fit = 0;
  let evidenceCount = 0;
  let strongTitleMatch = false;
  let secondaryOnly = false;
  let avoidTitleMatch = false;

  for (const avoidTitle of profile.avoidTitles) {
    if (phraseMatch(title, avoidTitle)) {
      avoidTitleMatch = true;
      fit -= 35;
    } else if (phraseMatch(body, avoidTitle)) {
      fit -= 10;
    }
  }

  for (const candidateTitle of profile.titles.slice(0, 8)) {
    if (candidateTitle.length <= 3) continue;
    if (phraseMatch(title, candidateTitle)) {
      fit += 36;
      evidenceCount += 2;
      strongTitleMatch = true;
    } else if (phraseMatch(body, candidateTitle)) {
      fit += 10;
      evidenceCount += 1;
    }
  }

  for (const token of profile.titleTokens.slice(0, 14)) {
    if (titleTokens.has(token)) {
      fit += 5;
      evidenceCount += 1;
      strongTitleMatch = true;
    } else if (body.includes(token)) {
      fit += 1;
    }
  }

  for (const term of profile.terms.slice(0, 28)) {
    const weight = Math.min(5, Math.max(1, term.weight / 4));
    if (title.includes(term.term)) {
      fit += weight * 2;
      evidenceCount += 1;
    } else if (body.includes(term.term)) {
      fit += weight;
    }
  }

  for (const candidateTitle of profile.secondaryTitles.slice(0, 6)) {
    if (candidateTitle.length <= 3) continue;
    if (phraseMatch(title, candidateTitle)) {
      fit += 22;
      evidenceCount += 1;
      secondaryOnly = !strongTitleMatch;
    } else if (phraseMatch(body, candidateTitle)) {
      fit += 7;
    }
  }

  const jobHasSpecificTitle = [...titleTokens].some((token) => !WEAK_JOB_WORDS.has(token));
  const hasProfileTitleToken =
    profile.titleTokens.length === 0 ||
    profile.titleTokens.some((token) => titleTokens.has(token)) ||
    profile.titles.some((candidateTitle) => phraseMatch(title, candidateTitle));

  if (jobHasSpecificTitle && !hasProfileTitleToken && fit < 20) fit -= 16;
  if (avoidTitleMatch && !strongTitleMatch) fit = Math.min(fit, -18);
  if (secondaryOnly && !strongTitleMatch) fit = Math.min(fit, 34);

  const score = Math.round(fit);
  return {
    score,
    roleScore: Math.max(0, Math.min(25, Math.round(score * 0.65))),
    strongTitleMatch,
    secondaryOnly,
    avoidTitleMatch,
    evidenceCount,
  };
}

export function familyLabels(profile: ResumeJobProfile) {
  return profile.labels.map((item) => item.label);
}

function safeJobSearchProfile(resume: ParsedResume): JobSearchProfile {
  const raw = (resume as { jobSearchProfile?: unknown }).jobSearchProfile;
  return JobSearchProfileSchema.parse(raw ?? undefined);
}

function addTitle(
  titleScores: Map<string, number>,
  weightedTerms: Map<string, { weight: number; source: TermSource }>,
  raw: string | null | undefined,
  weight: number,
) {
  const title = normalizeTitle(raw ?? "");
  if (!title) return;
  titleScores.set(title, (titleScores.get(title) ?? 0) + weight);
  addWeightedTerm(weightedTerms, title, weight, "title");
  for (const token of tokens(title)) addWeightedTerm(weightedTerms, token, weight * 0.7, "title");
}

function addSecondaryTitle(
  titleScores: Map<string, number>,
  weightedTerms: Map<string, { weight: number; source: TermSource }>,
  raw: string | null | undefined,
  weight: number,
) {
  const title = normalizeTitle(raw ?? "");
  if (!title) return;
  titleScores.set(title, (titleScores.get(title) ?? 0) + weight);
  addWeightedTerm(weightedTerms, title, weight * 0.25, "title");
}

function addAvoidTitle(titleScores: Map<string, number>, raw: string | null | undefined) {
  const title = normalizeTitle(raw ?? "");
  if (!title) return;
  titleScores.set(title, (titleScores.get(title) ?? 0) + 1);
}

function addTerms(
  weightedTerms: Map<string, { weight: number; source: TermSource }>,
  raw: string | null | undefined,
  weight: number,
  source: TermSource,
) {
  const words = tokens(raw ?? "");
  for (const token of words) addWeightedTerm(weightedTerms, token, weight, source);
  for (const phrase of ngrams(words, 2))
    addWeightedTerm(weightedTerms, phrase, weight * 1.25, source);
  for (const phrase of ngrams(words, 3))
    addWeightedTerm(weightedTerms, phrase, weight * 1.5, source);
}

function addListTerms(
  weightedTerms: Map<string, { weight: number; source: TermSource }>,
  list: Array<string | null | undefined>,
  weight: number,
  source: TermSource,
) {
  for (const item of list) {
    const term = normalize(item ?? "");
    if (!term || looksLikeRole(term)) continue;
    addWeightedTerm(weightedTerms, term, weight, source);
    for (const token of tokens(term)) addWeightedTerm(weightedTerms, token, weight * 0.6, source);
  }
}

function addWeightedTerm(
  weightedTerms: Map<string, { weight: number; source: TermSource }>,
  term: string,
  weight: number,
  source: TermSource,
) {
  if (!term || STOP.has(term)) return;
  const existing = weightedTerms.get(term);
  weightedTerms.set(term, {
    weight: (existing?.weight ?? 0) + weight,
    source: existing?.source === "title" ? "title" : source,
  });
}

function normalizeTitle(value: string) {
  return normalize(value)
    .replace(/\b(junior|jr|senior|sr|lead|staff|principal|intern|trainee|entry level)\b/g, " ")
    .replace(/\b(remote|hybrid|onsite|contract|freelance|part time|full time)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9+#./ -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string) {
  return normalize(value)
    .split(/[\s/-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP.has(token));
}

function ngrams(words: string[], size: 2 | 3) {
  const phrases: string[] = [];
  for (let i = 0; i <= words.length - size; i++) {
    const phrase = words.slice(i, i + size);
    if (phrase.some((token) => WEAK_JOB_WORDS.has(token))) continue;
    phrases.push(phrase.join(" "));
  }
  return phrases;
}

function meaningfulTitle(title: string) {
  const titleTokens = tokens(title);
  return titleTokens.length > 0 && titleTokens.some((token) => !WEAK_JOB_WORDS.has(token));
}

function phraseMatch(haystack: string, needle: string) {
  const normalized = normalizeTitle(needle);
  if (!normalized || normalized.length <= 2) return false;
  if (haystack.includes(normalized)) return true;
  const needleTokens = tokens(normalized).filter((token) => !WEAK_JOB_WORDS.has(token));
  if (needleTokens.length === 0) return false;
  const haystackTokens = new Set(tokens(haystack));
  const matched = needleTokens.filter((token) => haystackTokens.has(token)).length;
  return matched / needleTokens.length >= 0.7;
}

function compatibleTitle(primary: string, candidate: string) {
  const p = comparableTokens(primary);
  const c = comparableTokens(candidate);
  if (normalizeComparable(primary) === normalizeComparable(candidate)) return true;
  if (p.length === 0 || c.length === 0) return false;

  const overlap = c.filter((token) => p.includes(token)).length;
  if (overlap / Math.min(p.length, c.length) >= 0.45) return true;

  return roleHeadsCompatible(roleHead(primary), roleHead(candidate));
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

function comparableTokens(value: string) {
  return normalizeComparable(value)
    .split(" ")
    .filter((token) => token.length > 1 && !TITLE_STOP.has(token));
}

function roleHead(value: string) {
  return comparableTokens(value).find((token) => ROLE_HEADS.has(token)) ?? "";
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

function looksLikeRole(value: string) {
  return /\b(developer|engineer|analyst|manager|designer|editor|consultant|specialist|administrator|architect)\b/i.test(
    value,
  );
}

function makeLabels(titles: string[], terms: ProfileTerm[]) {
  return unique([...titles.slice(0, 3), ...terms.slice(0, 5).map((term) => term.term)])
    .slice(0, 6)
    .map((label, index) => ({ label, score: terms[index]?.weight ?? 1 }));
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
