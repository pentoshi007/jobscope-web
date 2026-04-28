import { render } from "@react-email/components";
import { type NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { errorToLog, logAppEvent } from "@/lib/app-log";
import { connectMongoose, getDb } from "@/lib/db";
import { DigestEmail } from "@/lib/email/digest-template";
import { env } from "@/lib/env";
import { buildResumeJobProfile, jobMatchesProfile } from "@/lib/jobs/profile";
import { rankJobsForUser } from "@/lib/jobs/rank";
import { parsePrefs } from "@/lib/preferences";
import { formatRelative, formatSalary } from "@/lib/utils";
import { Job } from "@/models/job";
import { Resume } from "@/models/resume";

export const maxDuration = 60;

const TOP_N = 8;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  await connectMongoose();
  const resend = new Resend(env.RESEND_API_KEY);
  const db = getDb();
  const users = await db
    .collection("user")
    .find(
      { emailVerified: true },
      { projection: { id: 1, email: 1, name: 1, preferences: 1, _id: 1 } },
    )
    .toArray();

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  // 48-hour window so daily diffs stay rich even if cron skips a day.
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const recent = await Job.find({
    postedAt: { $gte: since },
    $or: [{ cacheExpiresAt: { $gte: new Date() } }, { fetchedAt: { $gte: since } }],
  })
    .sort({ postedAt: -1 })
    .limit(500)
    .lean();

  await Promise.allSettled(
    users.map(async (u) => {
      const userId = String(u.id ?? u._id);
      try {
        const prefs = parsePrefs(u.preferences as string | undefined);
        if (!prefs.alerts.dailyDigest || !u.email) {
          skipped++;
          return;
        }
        const resumes = await Resume.find({ userId, isActive: true, deletedAt: null }).lean();
        if (resumes.length === 0) {
          skipped++;
          return;
        }

        const profile = buildResumeJobProfile(resumes.map((resume) => resume.parsed as never));
        const ranked = rankJobsForUser<(typeof recent)[number]>(
          resumes.map((resume) => resume.parsed as never),
          recent.filter((j) => jobMatchesProfile(profile, j as never)),
          {
            preferredLocations: prefs.preferredLocations,
            roleProfile: profile,
            minScore: prefs.minMatchScore,
            limit: TOP_N,
            remoteOnly: prefs.remoteOnly,
          },
        );

        if (ranked.length === 0) {
          skipped++;
          return;
        }

        const html = await render(
          DigestEmail({
            name: ((u.name as string) ?? "").split(" ")[0] || "there",
            appUrl: env.NEXT_PUBLIC_APP_URL,
            jobs: ranked.map(({ j, m }) => ({
              id: String(j._id),
              title: j.title,
              company: j.company,
              location: j.location ?? "",
              remote: !!j.remote,
              score: m.score,
              url: j.url,
              source: j.source,
              matched: m.matchedSkills,
              missing: m.missingSkills,
              postedAt: formatRelative(j.postedAt),
              salary:
                formatSalary(j.salary?.min, j.salary?.max, j.salary?.currency, j.salary?.period) ??
                "",
            })),
          }),
        );

        await resend.emails.send({
          from: env.EMAIL_FROM,
          to: u.email as string,
          subject: `${ranked.length} new matches · top ${ranked[0].m.score} · ${ranked[0].j.title}`,
          html,
        });
        sent++;
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
