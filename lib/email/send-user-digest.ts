import { render } from "@react-email/components";
import { Resend } from "resend";
import { DigestEmail } from "@/lib/email/digest-template";
import { env } from "@/lib/env";
import { buildResumeJobProfile, jobMatchesProfile } from "@/lib/jobs/profile";
import { rankJobsForUser } from "@/lib/jobs/rank";
import { parsePrefs } from "@/lib/preferences";
import { type ParsedResume, ParsedResumeSchema } from "@/lib/resume/schema";
import { formatRelative, formatSalary } from "@/lib/utils";
import { Job } from "@/models/job";

const DEFAULT_TOP_N = 8;
const DEFAULT_RECENT_HOURS = 48;

type DigestUser = {
  id?: unknown;
  _id?: unknown;
  email?: string | null;
  emailVerified?: boolean | null;
  name?: string | null;
  preferences?: string | null;
};

type DigestResume = {
  parsed?: unknown;
};

type DigestJob = {
  _id: unknown;
  title: string;
  company: string;
  location?: string | null;
  remote?: boolean | null;
  score?: number;
  url: string;
  source: string;
  matched?: string[];
  missing?: string[];
  postedAt: Date;
  salary?: {
    min?: number | null;
    max?: number | null;
    currency?: string | null;
    period?: "year" | "month" | "hour" | null;
  } | null;
  description?: string;
  category?: string | null;
  tags?: string[] | null;
  extractedSkills?: string[] | null;
  country?: string | null;
  workMode?: string | null;
  seniority?: "junior" | "mid" | "senior" | "staff" | "unknown" | null;
  sourceQuality?: number | null;
  cacheExpiresAt?: Date | null;
};

export type SendUserDigestResult =
  | { status: "sent"; count: number; topScore: number; topTitle: string }
  | { status: "skipped"; reason: string };

export async function loadRecentDigestJobs(hours = DEFAULT_RECENT_HOURS) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  return (await Job.find({
    postedAt: { $gte: since },
    $or: [{ cacheExpiresAt: { $gte: new Date() } }, { fetchedAt: { $gte: since } }],
  })
    .sort({ postedAt: -1 })
    .limit(500)
    .select({
      title: 1,
      company: 1,
      location: 1,
      remote: 1,
      seniority: 1,
      source: 1,
      url: 1,
      postedAt: 1,
      salary: 1,
      description: 1,
      category: 1,
      tags: 1,
      extractedSkills: 1,
      country: 1,
      workMode: 1,
      sourceQuality: 1,
      cacheExpiresAt: 1,
    })
    .lean()) as DigestJob[];
}

export async function sendUserDigestEmail({
  user,
  resumes,
  jobs,
  force = false,
  minScore,
  limit = DEFAULT_TOP_N,
}: {
  user: DigestUser;
  resumes: DigestResume[];
  jobs?: DigestJob[];
  force?: boolean;
  minScore?: number;
  limit?: number;
}): Promise<SendUserDigestResult> {
  const email = user.email?.trim();
  if (!email) return { status: "skipped", reason: "missing_email" };

  const prefs = parsePrefs(user.preferences);
  if (!force && !user.emailVerified) return { status: "skipped", reason: "email_unverified" };
  if (!force && !prefs.alerts.dailyDigest) return { status: "skipped", reason: "digest_disabled" };

  const parsedResumes: ParsedResume[] = [];
  for (const resume of resumes) {
    const parsed = ParsedResumeSchema.safeParse(resume.parsed);
    if (parsed.success) parsedResumes.push(parsed.data);
  }
  if (parsedResumes.length === 0) return { status: "skipped", reason: "missing_resume" };

  const recentJobs = jobs ?? (await loadRecentDigestJobs());
  const profile = buildResumeJobProfile(parsedResumes);
  const ranked = rankJobsForUser<DigestJob>(
    parsedResumes,
    recentJobs.filter((job) => jobMatchesProfile(profile, job)),
    {
      preferredLocations: prefs.preferredLocations,
      roleProfile: profile,
      minScore: minScore ?? prefs.minMatchScore,
      limit,
      remoteOnly: prefs.remoteOnly,
    },
  );

  if (ranked.length === 0) return { status: "skipped", reason: "no_matches" };

  const html = await render(
    DigestEmail({
      name: (user.name ?? "").split(" ")[0] || "there",
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
          formatSalary(j.salary?.min, j.salary?.max, j.salary?.currency, j.salary?.period) ?? "",
      })),
    }),
  );

  await new Resend(env.RESEND_API_KEY).emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: `${ranked.length} new matches · top ${ranked[0].m.score} · ${ranked[0].j.title}`,
    html,
  });

  return {
    status: "sent",
    count: ranked.length,
    topScore: ranked[0].m.score,
    topTitle: ranked[0].j.title,
  };
}
