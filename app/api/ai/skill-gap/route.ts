import { type NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { loadJobAndResume } from "@/lib/ai/context";
import { geminiText } from "@/lib/llm/gemini";
import { groqText } from "@/lib/llm/groq";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  const rl = rateLimit(`ai:${userId}`, 10, 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false, error: { code: "RATE_LIMITED" } }, { status: 429 });

  const { jobId } = (await req.json()) as { jobId?: string };
  if (!jobId) return NextResponse.json({ ok: false, error: { code: "BAD_REQUEST" } }, { status: 400 });

  const ctx = await loadJobAndResume(userId, jobId);
  if (!ctx) return NextResponse.json({ ok: false, error: { code: "NOT_FOUND" } }, { status: 404 });

  const prompt = `Analyze the gap between this candidate and this job. Output 4 sections with markdown-style headings (use plain text headings like "Strengths:" not #):
- Strengths (3 bullets, each ≤14 words)
- Gaps (3 bullets, each with WHY it matters)
- Quick wins (2-3 specific learning resources or projects)
- Verdict (one line, blunt)

CANDIDATE:
${ctx.redactedResume}

JOB:
${ctx.jobBlock}`;

  let text = "";
  try {
    text = await geminiText(prompt);
  } catch {
    text = await groqText("You are a senior career coach.", prompt);
  }
  return NextResponse.json({ ok: true, data: text });
}
