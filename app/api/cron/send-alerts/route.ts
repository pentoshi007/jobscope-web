import { type NextRequest, NextResponse } from "next/server";
import { render } from "@react-email/components";
import { Resend } from "resend";
import { connectMongoose, getDb } from "@/lib/db";
import { Resume } from "@/models/resume";
import { Job } from "@/models/job";
import { score } from "@/lib/match/score";
import { env } from "@/lib/env";
import { parsePrefs } from "@/lib/preferences";
import { DigestEmail } from "@/lib/email/digest-template";

export const maxDuration = 60;

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
    .find({ emailVerified: true }, { projection: { id: 1, email: 1, name: 1, preferences: 1, _id: 1 } })
    .toArray();

  let sent = 0;
  let skipped = 0;

  const since = new Date(Date.now() - 36 * 60 * 60 * 1000);
  const recent = await Job.find({ postedAt: { $gte: since } })
    .sort({ postedAt: -1 })
    .limit(300)
    .lean();

  await Promise.allSettled(
    users.map(async (u) => {
      const prefs = parsePrefs(u.preferences as string | undefined);
      if (!prefs.alerts.dailyDigest || !u.email) {
        skipped++;
        return;
      }
      const userId = String(u.id ?? u._id);
      const resumes = await Resume.find({ userId, isActive: true, deletedAt: null }).lean();
      if (resumes.length === 0) {
        skipped++;
        return;
      }
      const ranked = recent
        .map((j) => {
          const matches = resumes.map((r) =>
            score(r.parsed as never, j as never, { preferredLocations: prefs.preferredLocations }),
          );
          return { j, m: matches.reduce((a, b) => (a.score >= b.score ? a : b)) };
        })
        .filter(({ m }) => m.score >= prefs.minMatchScore)
        .sort((a, b) => b.m.score - a.m.score)
        .slice(0, 5);

      if (ranked.length === 0) {
        skipped++;
        return;
      }

      const html = await render(
        DigestEmail({
          name: (u.name as string) ?? "there",
          appUrl: env.NEXT_PUBLIC_APP_URL,
          jobs: ranked.map(({ j, m }) => ({
            id: String(j._id),
            title: j.title,
            company: j.company,
            location: j.location ?? "",
            remote: !!j.remote,
            score: m.score,
            url: j.url,
            matched: m.matchedSkills,
          })),
        }),
      );

      await resend.emails.send({
        from: env.EMAIL_FROM,
        to: u.email as string,
        subject: `${ranked.length} new matches for you on JobScope`,
        html,
      });
      sent++;
    }),
  );

  return NextResponse.json({ ok: true, data: { sent, skipped, totalUsers: users.length } });
}
