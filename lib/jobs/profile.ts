import type { ParsedResume } from "@/lib/resume/schema";

type TermSource = "title" | "skill" | "certification" | "experience" | "project" | "summary";

export interface ProfileTerm {
  term: string;
  weight: number;
  source: TermSource;
}

export interface ResumeJobProfile {
  primaryTitle: string;
  titles: string[];
  titleTokens: string[];
  terms: ProfileTerm[];
  queryRoles: string[];
  requiredTerms: string[];
  labels: Array<{ label: string; score: number }>;
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

  for (const resume of resumes) {
    addTitle(titleScores, weightedTerms, resume.headline, 9);

    resume.experience.slice(0, 2).forEach((exp, index) => {
      addTitle(titleScores, weightedTerms, exp.role, index === 0 ? 10 : 7);
      addTerms(weightedTerms, exp.description ?? "", index === 0 ? 2 : 1.2, "experience");
      addListTerms(weightedTerms, exp.skills ?? [], 5, "skill");
    });

    resume.experience.slice(2, 5).forEach((exp) => {
      addTitle(titleScores, weightedTerms, exp.role, 3);
      addTerms(weightedTerms, exp.description ?? "", 0.8, "experience");
    });

    addTerms(weightedTerms, resume.summary, 2, "summary");
    addListTerms(
      weightedTerms,
      [
        ...resume.skills.languages,
        ...resume.skills.frameworks,
        ...resume.skills.tools,
        ...resume.skills.databases,
        ...resume.skills.cloud,
        ...resume.skills.soft,
      ],
      4,
      "skill",
    );
    addListTerms(
      weightedTerms,
      resume.certifications.map((cert) => cert.name),
      6,
      "certification",
    );
    for (const project of resume.projects.slice(0, 4)) {
      addTitle(titleScores, weightedTerms, project.name, 1.5);
      addTerms(
        weightedTerms,
        `${project.description} ${(project.skills ?? []).join(" ")}`,
        1.5,
        "project",
      );
    }
  }

  const titles = [...titleScores.entries()]
    .filter(([title]) => meaningfulTitle(title))
    .sort((a, b) => b[1] - a[1])
    .map(([title]) => title)
    .slice(0, 6);

  const terms = [...weightedTerms.entries()]
    .map(([term, value]) => ({ term, weight: value.weight, source: value.source }))
    .filter(({ term }) => term.length > 1 && !STOP.has(term))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 40);

  const primaryTitle = titles[0] ?? terms[0]?.term ?? "general";
  const titleTokens = unique(titles.flatMap((title) => tokens(title))).filter(
    (token) => !WEAK_JOB_WORDS.has(token),
  );
  const requiredTerms = unique([
    ...titles.slice(0, 3),
    ...terms.filter((term) => term.source !== "summary").map((term) => term.term),
  ]).slice(0, 12);
  const queryRoles = unique([
    ...titles.slice(0, 4),
    ...terms
      .filter((term) => term.source === "certification" || term.source === "skill")
      .slice(0, 4)
      .map((term) => term.term),
  ]).slice(0, 6);

  return {
    primaryTitle,
    titles,
    titleTokens,
    terms,
    queryRoles: queryRoles.length ? queryRoles : [primaryTitle],
    requiredTerms: requiredTerms.length ? requiredTerms : [primaryTitle],
    labels: makeLabels(titles, terms),
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
  return roleFitScore(profile, job) >= 4;
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
  const title = normalize(job.title ?? "");
  const titleTokens = new Set(tokens(title));
  const body = normalize(
    [
      job.category ?? "",
      (job.tags ?? []).join(" "),
      (job.extractedSkills ?? []).join(" "),
      (job.description ?? "").slice(0, 1600),
    ].join(" "),
  );

  let fit = 0;
  for (const candidateTitle of profile.titles.slice(0, 4)) {
    if (candidateTitle.length > 3 && title.includes(candidateTitle)) fit += 14;
    else if (candidateTitle.length > 3 && body.includes(candidateTitle)) fit += 5;
  }

  for (const token of profile.titleTokens.slice(0, 10)) {
    if (titleTokens.has(token)) fit += 4;
    else if (body.includes(token)) fit += 1;
  }

  for (const term of profile.terms.slice(0, 24)) {
    const weight = Math.min(6, Math.max(1, term.weight / 3));
    if (title.includes(term.term)) fit += weight * 2;
    else if (body.includes(term.term)) fit += weight;
  }

  const jobHasSpecificTitle = [...titleTokens].some((token) => !WEAK_JOB_WORDS.has(token));
  const hasStrongTitleMatch =
    profile.titleTokens.length === 0 ||
    profile.titleTokens.some((token) => titleTokens.has(token)) ||
    profile.titles.some((candidateTitle) => title.includes(candidateTitle));

  if (jobHasSpecificTitle && !hasStrongTitleMatch && fit < 8) fit -= 12;
  return Math.round(fit);
}

export function familyLabels(profile: ResumeJobProfile) {
  return profile.labels.map((item) => item.label);
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
    if (!term) continue;
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

function makeLabels(titles: string[], terms: ProfileTerm[]) {
  return unique([...titles.slice(0, 3), ...terms.slice(0, 5).map((term) => term.term)])
    .slice(0, 6)
    .map((label, index) => ({ label, score: terms[index]?.weight ?? 1 }));
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
