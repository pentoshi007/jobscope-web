import { ParsedResumeSchema, type ParsedResume } from "./schema";
import { geminiJson } from "../llm/gemini";
import { groqJson } from "../llm/groq";
import { redactPII } from "../llm/redact";

const SCHEMA_DOC = `{
  "fullName": string,
  "email": string,
  "phone": string,
  "location": string,
  "summary": string,
  "skills": {
    "languages": string[],
    "frameworks": string[],
    "tools": string[],
    "databases": string[],
    "cloud": string[],
    "soft": string[]
  },
  "experience": [{ "company": string, "role": string, "startDate": string, "endDate": string, "description": string, "skills": string[] }],
  "education": [{ "school": string, "degree": string, "field": string, "startDate": string, "endDate": string }],
  "certifications": string[],
  "totalYearsExperience": number,
  "inferredSeniority": "junior" | "mid" | "senior" | "staff"
}`;

const SYSTEM = `You are a strict resume parser. Output ONLY valid JSON matching this exact schema, no prose, no markdown:
${SCHEMA_DOC}

Rules:
- Categorize technical skills accurately (languages = programming langs only; frameworks/libraries separate; tools = CLI/IDEs/git etc; databases separate; cloud = AWS/GCP/Azure services).
- inferredSeniority: junior < 2 years, mid 2-5, senior 5-9, staff 9+.
- totalYearsExperience: integer, sum of unique work tenure.
- Preserve PII placeholders like [EMAIL_0] verbatim in fields like email/phone.`;

function buildPrompt(text: string, strict = false) {
  const guard = strict
    ? "\n\nYour previous output was invalid. Output ONLY the JSON object, nothing else. Do not wrap in markdown."
    : "";
  return `${SYSTEM}${guard}\n\nResume text:\n${text.slice(0, 30_000)}`;
}

export async function parseResume(rawText: string): Promise<ParsedResume> {
  const { text, restore } = redactPII(rawText);

  let parsedRaw: unknown;
  try {
    parsedRaw = await geminiJson<unknown>(buildPrompt(text));
  } catch {
    try {
      parsedRaw = await geminiJson<unknown>(buildPrompt(text, true));
    } catch {
      parsedRaw = await groqJson<unknown>(SYSTEM, `Resume text:\n${text.slice(0, 30_000)}`);
    }
  }

  const v = ParsedResumeSchema.safeParse(parsedRaw);
  const parsed = v.success ? v.data : ParsedResumeSchema.parse({});

  parsed.email = restore(parsed.email);
  parsed.phone = restore(parsed.phone);
  parsed.fullName = restore(parsed.fullName);
  parsed.summary = restore(parsed.summary);
  for (const e of parsed.experience) {
    e.description = restore(e.description);
  }

  return parsed;
}
