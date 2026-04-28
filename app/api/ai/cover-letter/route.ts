import { after, type NextRequest, NextResponse } from "next/server";
import { loadJobAndResume } from "@/lib/ai/context";
import { errorToLog, logAppEvent } from "@/lib/app-log";
import { geminiText } from "@/lib/llm/gemini";
import { groqText } from "@/lib/llm/groq";
import { rateLimit } from "@/lib/rate-limit";
import { requireUserId } from "@/lib/session";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  const rl = rateLimit(`ai:${userId}`, 10, 60_000);
  if (!rl.ok) {
    after(() =>
      logAppEvent({
        level: "warn",
        kind: "rate_limit",
        source: "api.ai.cover-letter",
        path: "/api/ai/cover-letter",
        userId,
        status: 429,
        message: "AI cover letter rate limit exceeded",
      }),
    );
    return NextResponse.json(
      { ok: false, error: { code: "RATE_LIMITED", message: "Slow down" } },
      { status: 429 },
    );
  }
  const { jobId } = (await req.json()) as { jobId?: string };
  if (!jobId)
    return NextResponse.json({ ok: false, error: { code: "BAD_REQUEST" } }, { status: 400 });

  const ctx = await loadJobAndResume(userId, jobId);
  if (!ctx)
    return NextResponse.json(
      { ok: false, error: { code: "NOT_FOUND", message: "Need an active resume and a valid job" } },
      { status: 404 },
    );

  const prompt = `Write a personalized, concise (220-280 words) cover letter for this job. Use the candidate's actual experience. Plain text, no markdown headings, no salutations beyond "Dear Hiring Team,". Do not invent achievements.

CANDIDATE:
${ctx.redactedResume}

JOB:
${ctx.jobBlock}`;

  let text = "";
  try {
    text = await geminiText(prompt);
  } catch {
    try {
      text = await groqText(
        "You write tailored, honest, concise cover letters in plain text.",
        prompt,
      );
    } catch (e) {
      const details = errorToLog(e);
      after(() =>
        logAppEvent({
          kind: "api",
          source: "api.ai.cover-letter",
          path: "/api/ai/cover-letter",
          userId,
          status: 500,
          message: details.message,
          stack: details.stack,
        }),
      );
      return NextResponse.json(
        {
          ok: false,
          error: { code: "AI_FAILED", message: details.message || "AI failed" },
        },
        { status: 500 },
      );
    }
  }
  return NextResponse.json({ ok: true, data: text });
}
