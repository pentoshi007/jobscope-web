import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { refreshJobsForUser } from "@/lib/jobs/user-refresh";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(req: NextRequest) {
  const auth = req.headers.get("x-internal-secret");
  if (!auth || auth !== env.CRON_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { userId } = (await req.json().catch(() => ({}))) as { userId?: string };
  if (!userId) return NextResponse.json({ ok: false, error: "Missing userId" }, { status: 400 });

  try {
    const result = await refreshJobsForUser(userId);
    return NextResponse.json({ ok: true, data: result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "refresh failed" },
      { status: 500 },
    );
  }
}
