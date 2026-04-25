import { extractSkillsFromText } from "@/data/skills-dictionary";
import { geminiJson } from "../llm/gemini";

export function quickSkillExtract(text: string): string[] {
  return extractSkillsFromText(text);
}

export async function llmSkillExtract(jobs: { title: string; description: string }[]): Promise<string[][]> {
  if (jobs.length === 0) return [];
  const prompt = `Extract technical skills from each job below. Output JSON: { "results": string[][] } where results[i] is an array of skill names (lowercase, deduplicated, max 15 each) for job i.

${jobs.map((j, i) => `[${i}] ${j.title}\n${j.description.slice(0, 600)}`).join("\n\n")}`;
  try {
    const r = await geminiJson<{ results: string[][] }>(prompt);
    return r.results ?? jobs.map(() => []);
  } catch {
    return jobs.map((j) => quickSkillExtract(`${j.title} ${j.description}`));
  }
}
