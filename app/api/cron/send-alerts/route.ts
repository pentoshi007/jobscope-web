import { type NextRequest, NextResponse } from "next/server";
import { errorToLog, logAppEvent } from "@/lib/app-log";
import { connectMongoose, getDb } from "@/lib/db";
import { loadRecentDigestJobs, sendUserDigestEmail } from "@/lib/email/send-user-digest";
import { env } from "@/lib/env";
import { parsePrefs } from "@/lib/preferences";
import { Resume } from "@/models/resume";

export const maxDuration = 60;

const TOP_N = 8;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  await connectMongoose();
  const db = getDb();
  const users = await db
    .collection("user")
    .find(
      { emailVerified: true },
      { projection: { id: 1, email: 1, emailVerified: 1, name: 1, preferences: 1, _id: 1 } },
    )
    .toArray();

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  const recent = await loadRecentDigestJobs();

  await Promise.allSettled(
    users.map(async (u) => {
      const userId = String(u.id ?? u._id);
      try {
        const prefs = parsePrefs(u.preferences as string | undefined);
        if (!prefs.alerts.dailyDigest || !u.email) {
          skipped++;
          return;
        }
        const resumes = await Resume.find({ userId, isActive: true, deletedAt: null })
          .select({ parsed: 1 })
          .lean();
        if (resumes.length === 0) {
          skipped++;
          return;
        }

        const result = await sendUserDigestEmail({ user: u, resumes, jobs: recent, limit: TOP_N });
        if (result.status === "sent") {
          sent++;
        } else {
          skipped++;
        }
      } catch (e) {
        failed++;
        const details = errorToLog(e);
        await logAppEvent({
          kind: "email",
          source: "cron.send-alerts",
          path: "/api/cron/send-alerts",
          userId,
          message: details.message,
          stack: details.stack,
        });
      }
    }),
  );

  if (failed > 0) {
    await logAppEvent({
      level: "warn",
      kind: "email",
      source: "cron.send-alerts.summary",
      path: "/api/cron/send-alerts",
      message: `${failed} digest emails failed`,
      meta: { sent, skipped, failed, totalUsers: users.length },
    });
  }

  return NextResponse.json({ ok: true, data: { sent, skipped, failed, totalUsers: users.length } });
}
