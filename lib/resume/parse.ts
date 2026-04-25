import { ParsedResumeSchema, type ParsedResume } from "./schema";
import { geminiJson } from "../llm/gemini";
import { groqJson } from "../llm/groq";
import { redactPII } from "../llm/redact";

const MAX_PROMPT_CHARS = 28_000;
const HEAD_CHARS = 20_000;
const TAIL_CHARS = 8_000;

const SCHEMA_DOC = `{
  "fullName": string,
  "email": string,
  "phone": string,
  "location": string,
  "headline": string,                       // short title under name, e.g. "Senior Backend Engineer"
  "summary": string,                        // 1-3 sentence professional summary
  "links": {
    "website": string,                      // personal site / blog
    "linkedin": string,                     // full URL if present
    "github": string,
    "portfolio": string,                    // dribbble, behance, etc.
    "twitter": string,
    "other": string[]                       // any remaining profile URLs
  },
  "skills": {
    "languages": string[],                  // programming languages only (Python, Go, JS, ...)
    "frameworks": string[],                 // React, Django, Spring, ...
    "tools": string[],                      // git, Docker, Jira, Figma, IDEs, build tools
    "databases": string[],                  // PostgreSQL, Mongo, Redis, ...
    "cloud": string[],                      // AWS/GCP/Azure services
    "soft": string[]                        // leadership, communication, etc.
  },
  "experience": [{
    "company": string,
    "role": string,
    "location": string,
    "startDate": string,                    // "MMM YYYY" or "YYYY"
    "endDate": string,                      // "Present" if current
    "description": string,                  // bullet points joined with "\\n• "
    "skills": string[]                      // tech mentioned in this role
  }],
  "education": [{
    "school": string,
    "degree": string,                       // e.g. "B.Tech", "MS"
    "field": string,                        // e.g. "Computer Science"
    "location": string,
    "startDate": string,
    "endDate": string,
    "gpa": string,                          // raw as written, e.g. "8.7/10" or "3.9"
    "honors": string                        // "Magna Cum Laude", "Dean's List", etc.
  }],
  "projects": [{
    "name": string,
    "description": string,
    "url": string,
    "skills": string[]
  }],
  "certifications": [{
    "name": string,                         // e.g. "AWS Solutions Architect"
    "issuer": string,                       // e.g. "Amazon"
    "date": string,
    "url": string
  }],
  "achievements": string[],                 // hackathons, competitions, notable wins
  "awards": string[],                       // formal awards
  "publications": string[],                 // papers, articles, talks
  "languagesSpoken": string[],              // human languages (English, Hindi, ...)
  "totalYearsExperience": number,
  "inferredSeniority": "junior" | "mid" | "senior" | "staff"
}`;

const SYSTEM = `You are an expert resume parser. Extract structured data from the resume text and output ONLY valid JSON matching this exact schema. No prose, no markdown, no code fences:
${SCHEMA_DOC}

Rules:
- Extract EVERY section that exists. If a field is genuinely absent, return "" or [].
- EXPERIENCE is critical: look for sections titled "Experience", "Work Experience", "Professional Experience", "Employment History", or similar. Each role should have company, role/title, dates, and bullet point descriptions. Even if formatting is messy, extract every job entry.
- For each experience entry, capture ALL bullet points/descriptions as a single string joined with "\\n• ".
- Skills categorization: languages = programming languages only; frameworks = libraries/frameworks; tools = CLIs/IDEs/build tools/design tools; databases separate; cloud = AWS/GCP/Azure services. Do NOT duplicate a skill across categories.
- Look hard for links/URLs anywhere in the text — header, footer, contact line, project lines. URLs may appear in these formats:
  * Direct URLs: https://example.com
  * Parenthesized after text: "My Website (https://example.com)" — extract the URL from parentheses
  * Labeled: "Website: example.com" or "Portfolio: https://dribbble.com/user"
  Classify each URL into website/linkedin/github/portfolio/twitter/other based on the domain.
- Personal website = a domain owned by the candidate (e.g. johndoe.com, ani.dev). NOT linkedin/github/twitter.
- Projects often appear under headers like "Projects", "Side Projects", "Personal Projects", "Open Source". Capture each project name and its URL if present.
- Certifications can be a flat list under "Certifications" or "Licenses". Extract issuer separately when written (e.g. "AWS Certified — Amazon, 2023").
- Achievements / Awards / Honors: hackathon wins, scholarships, competition placements, "Top 1%", "Employee of the Year", etc.
- Publications: papers, blog posts, conference talks.
- inferredSeniority: junior < 2 years total work, mid 2–5, senior 5–9, staff 9+.
- totalYearsExperience: integer, sum of unique professional work tenure (exclude internships under 6 months unless explicitly counted).
- PII placeholders: The input text may contain tokens like [EMAIL_0], [PHONE_0]. Copy these verbatim into the corresponding fields. Do NOT invent new placeholder tokens — if the text says "John Doe", output "John Doe" for fullName, NOT "[NAME_0]".
- Output ONLY the JSON object. Do not wrap in \`\`\`json fences. Do not add commentary.`;

function buildPrompt(text: string, strict = false) {
  const guard = strict
    ? "\n\nYour previous output was invalid JSON. Output ONLY the JSON object — no markdown fences, no prose."
    : "";
  return `${SYSTEM}${guard}\n\nResume text:\n${text}`;
}

function preprocess(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/ /g, " ")
    .replace(/[•●▪◦·]/g, "•")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^[ \t]+/gm, "")
    .replace(/[ \t]+$/gm, "")
    .trim();
}

function smartTruncate(text: string): string {
  if (text.length <= MAX_PROMPT_CHARS) return text;
  return `${text.slice(0, HEAD_CHARS)}\n\n[…truncated…]\n\n${text.slice(-TAIL_CHARS)}`;
}

const URL_RE = /\bhttps?:\/\/[^\s<>"')\]]+|(?<![\w@.])www\.[\w.-]+\.[a-z]{2,}(?:\/[^\s<>"')\]]*)?/gi;
const HANDLE_LINKEDIN_RE = /(?:linkedin\.com\/in\/|linkedin:\s*)([\w-]+)/i;
const HANDLE_GITHUB_RE = /(?:github\.com\/|github:\s*)([\w-]+)/i;
const HANDLE_TWITTER_RE = /(?:twitter\.com\/|x\.com\/|@)([\w]{2,15})\b/i;

function normalizeUrl(u: string): string {
  let s = u.trim().replace(/[),.;]+$/g, "");
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  return s;
}

function classifyLinks(text: string): {
  website: string;
  linkedin: string;
  github: string;
  portfolio: string;
  twitter: string;
  other: string[];
} {
  const found = new Set<string>();
  const matches = text.match(URL_RE) ?? [];
  for (const m of matches) found.add(normalizeUrl(m));

  // Recover bare handles (e.g. "github: jane")
  const li = text.match(HANDLE_LINKEDIN_RE);
  if (li?.[1]) found.add(`https://linkedin.com/in/${li[1]}`);
  const gh = text.match(HANDLE_GITHUB_RE);
  if (gh?.[1]) found.add(`https://github.com/${gh[1]}`);
  const tw = text.match(HANDLE_TWITTER_RE);
  if (tw?.[1] && !/^(github|linkedin|gmail|yahoo|hotmail|outlook)$/i.test(tw[1])) {
    found.add(`https://twitter.com/${tw[1]}`);
  }

  const out = { website: "", linkedin: "", github: "", portfolio: "", twitter: "", other: [] as string[] };
  const portfolioHosts = /(behance|dribbble|figma|medium|dev\.to|hashnode|substack|notion\.site|read\.cv)/i;
  const otherIgnore = /(gmail|yahoo|hotmail|outlook|protonmail)\.com$/i;

  for (const url of found) {
    let host: string;
    try {
      host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      continue;
    }
    if (otherIgnore.test(host)) continue;
    if (host.includes("linkedin.com")) {
      if (!out.linkedin) out.linkedin = url;
    } else if (host.includes("github.com") || host.includes("gitlab.com") || host.includes("bitbucket.org")) {
      if (!out.github) out.github = url;
    } else if (host === "twitter.com" || host === "x.com") {
      if (!out.twitter) out.twitter = url;
    } else if (portfolioHosts.test(host)) {
      if (!out.portfolio) out.portfolio = url;
    } else if (!out.website) {
      out.website = url;
    } else if (!out.other.includes(url)) {
      out.other.push(url);
    }
  }
  return out;
}

function mergeLinks(parsed: ParsedResume, fromText: ReturnType<typeof classifyLinks>) {
  const l = parsed.links;
  l.website ||= fromText.website;
  l.linkedin ||= fromText.linkedin;
  l.github ||= fromText.github;
  l.portfolio ||= fromText.portfolio;
  l.twitter ||= fromText.twitter;
  const seen = new Set([l.website, l.linkedin, l.github, l.portfolio, l.twitter, ...l.other].filter(Boolean));
  for (const u of fromText.other) {
    if (!seen.has(u)) {
      l.other.push(u);
      seen.add(u);
    }
  }
}

function dedupeStringArray(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of arr) {
    const s = raw.trim();
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

function postProcess(parsed: ParsedResume): ParsedResume {
  for (const cat of ["languages", "frameworks", "tools", "databases", "cloud", "soft"] as const) {
    parsed.skills[cat] = dedupeStringArray(parsed.skills[cat]);
  }
  parsed.achievements = dedupeStringArray(parsed.achievements);
  parsed.awards = dedupeStringArray(parsed.awards);
  parsed.publications = dedupeStringArray(parsed.publications);
  parsed.languagesSpoken = dedupeStringArray(parsed.languagesSpoken);
  return parsed;
}

export async function parseResume(rawText: string): Promise<ParsedResume> {
  const cleaned = preprocess(rawText);
  const linksFromText = classifyLinks(cleaned);

  const { text: redacted, restore } = redactPII(cleaned, { keepUrls: true });
  const promptText = smartTruncate(redacted);

  let parsedRaw: unknown;
  try {
    parsedRaw = await geminiJson<unknown>(buildPrompt(promptText));
  } catch {
    try {
      parsedRaw = await geminiJson<unknown>(buildPrompt(promptText, true));
    } catch {
      parsedRaw = await groqJson<unknown>(SYSTEM, `Resume text:\n${promptText}`);
    }
  }

  const v = ParsedResumeSchema.safeParse(parsedRaw);
  const parsed = v.success ? v.data : ParsedResumeSchema.parse({});

  // Restore redacted PII
  parsed.email = restore(parsed.email);
  parsed.phone = restore(parsed.phone);
  parsed.fullName = restore(parsed.fullName);
  parsed.summary = restore(parsed.summary);
  parsed.location = restore(parsed.location);
  parsed.headline = restore(parsed.headline);
  for (const e of parsed.experience) {
    e.description = restore(e.description);
    e.company = restore(e.company);
    e.role = restore(e.role);
    e.location = restore(e.location);
  }
  for (const p of parsed.projects) p.description = restore(p.description);
  for (const ed of parsed.education) {
    ed.school = restore(ed.school);
    ed.location = restore(ed.location);
  }

  // Clean up any LLM-invented placeholder tokens (e.g. [NAME_0], [LOCATION_0])
  // that don't correspond to real redaction tokens
  const inventedPlaceholderRe = /^\[\w+_\d+\]$/;
  if (inventedPlaceholderRe.test(parsed.fullName)) parsed.fullName = "";
  if (inventedPlaceholderRe.test(parsed.location)) parsed.location = "";
  if (inventedPlaceholderRe.test(parsed.headline)) parsed.headline = "";
  if (inventedPlaceholderRe.test(parsed.summary)) parsed.summary = "";

  mergeLinks(parsed, linksFromText);
  return postProcess(parsed);
}
