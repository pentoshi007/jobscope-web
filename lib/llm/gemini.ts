import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../env";

const genai = new GoogleGenerativeAI(env.GEMINI_API_KEY);

export function geminiFlash() {
  return genai.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
  });
}

export function geminiFlashText() {
  return genai.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: { temperature: 0.5 },
  });
}

export async function geminiJson<T>(prompt: string): Promise<T> {
  const model = geminiFlash();
  const res = await model.generateContent(prompt);
  const txt = res.response.text();
  return JSON.parse(txt) as T;
}

export async function geminiText(prompt: string): Promise<string> {
  const model = geminiFlashText();
  const res = await model.generateContent(prompt);
  return res.response.text();
}
