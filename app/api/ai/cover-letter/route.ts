import { type NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { loadJobAndResume } from "@/lib/ai/context";
import { geminiFlashText } from "@/lib/llm/gemini";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  const rl = rateLimit(`ai:${userId}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: { code: "RATE_LIMITED", message: "Slow down" } },
      { status: 429 },
    );
  }
  const { jobId } = (await req.json()) as { jobId?: string };
  if (!jobId) return NextResponse.json({ ok: false, error: { code: "BAD_REQUEST" } }, { status: 400 });

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

  try {
    const model = geminiFlashText();
    const stream = await model.generateContentStream(prompt);
    const encoder = new TextEncoder();
    const rs = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream.stream) {
            const t = chunk.text();
            if (t) controller.enqueue(encoder.encode(t));
          }
        } catch (e) {
          controller.enqueue(encoder.encode(`\n\n[Error: ${e instanceof Error ? e.message : "stream"}]`));
        } finally {
          controller.close();
        }
      },
    });
    return new Response(rs, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "AI_FAILED", message: e instanceof Error ? e.message : "AI failed" },
      },
      { status: 500 },
    );
  }
}
