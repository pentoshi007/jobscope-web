import Groq from "groq-sdk";
import { env } from "../env";

export const groq = new Groq({ apiKey: env.GROQ_API_KEY });

export async function groqJson<T>(system: string, user: string): Promise<T> {
  const res = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    response_format: { type: "json_object" },
    temperature: 0.2,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const txt = res.choices[0]?.message?.content ?? "{}";
  return JSON.parse(txt) as T;
}

export async function groqText(system: string, user: string): Promise<string> {
  const res = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    temperature: 0.5,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  return res.choices[0]?.message?.content ?? "";
}
