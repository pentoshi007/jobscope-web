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
        source: "api.ai.interview-prep",
        path: "/api/ai/interview-prep",
        userId,
        status: 429,
        message: "AI interview prep rate limit exceeded",
      }),
    );
    return NextResponse.json({ ok: false, error: { code: "RATE_LIMITED" } }, { status: 429 });
  }

  const { jobId } = (await req.json()) as { jobId?: string };
  if (!jobId)
    return NextResponse.json({ ok: false, error: { code: "BAD_REQUEST" } }, { status: 400 });

  const ctx = await loadJobAndResume(userId, jobId);
  if (!ctx) return NextResponse.json({ ok: false, error: { code: "NOT_FOUND" } }, { status: 404 });

  const prompt = `Generate an interview prep brief for this candidate applying to this role. Sections:
1. Likely interview format (1-2 lines, based on company/role)
2. 5 technical questions tailored to candidate's gaps & job's required skills
3. 3 behavioral questions (STAR-style answer hooks tied to candidate's actual experience)
4. 3 smart questions to ask the interviewer

CANDIDATE:
${ctx.redactedResume}

JOB:
${ctx.jobBlock}`;

  let text = "";
  try {
    text = await geminiText(prompt);
  } catch {
    try {
      text = await groqText("You are an experienced engineering interviewer.", prompt);
    } catch (e) {
      const details = errorToLog(e);
      after(() =>
        logAppEvent({
          kind: "api",
          source: "api.ai.interview-prep",
          path: "/api/ai/interview-prep",
          userId,
          status: 500,
          message: details.message,
          stack: details.stack,
        }),
      );
      return NextResponse.json({ ok: false, error: { code: "AI_FAILED" } }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true, data: text });
}
