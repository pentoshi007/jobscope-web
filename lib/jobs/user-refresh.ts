import { ObjectId } from "mongodb";
import { errorToLog, logAppEvent } from "@/lib/app-log";
import { connectMongoose, getDb } from "@/lib/db";
import { loadRecentDigestJobs, sendUserDigestEmail } from "@/lib/email/send-user-digest";
import { runApifyManual } from "@/lib/jobs/ingest/apify-linkedin";
import { enrichForUpsert, bulkUpsertJobs } from "@/lib/jobs/ingest/runner";
import { buildPersonalizedQuery, fetchAndStorePersonalizedJobs } from "@/lib/jobs/personalized";
import { buildAiJobSearchProfile } from "@/lib/jobs/search-profile";
import { recordSourceHealth } from "@/lib/jobs/source-health";
import { LINKEDIN_APIFY_SOURCE } from "@/lib/jobs/source-constants";
import { parsePrefs } from "@/lib/preferences";
import { type ParsedResume, ParsedResumeSchema } from "@/lib/resume/schema";
import { Resume } from "@/models/resume";

type UserRow = {
  id?: unknown;
  _id?: unknown;
  email?: string | null;
  emailVerified?: boolean | null;
  name?: string | null;
  preferences?: string | null;
};

export type RefreshUserJobsResult = {
  userId: string;
  profilesCreated: number;
  personalized: Record<string, { fetched: number; upserted: number; error?: string }>;
  apify: { fetched: number; upserted: number; error?: string };
  email: Awaited<ReturnType<typeof sendUserDigestEmail>>;
};

export async function refreshJobsForUser(userId: string): Promise<RefreshUserJobsResult> {
  await connectMongoose();
  const user = await loadUser(userId);
  if (!user) throw new Error("User not found");

  const resumes = await loadRefreshResumes(userId);
  if (resumes.length === 0) throw new Error("No resume found for this user");

  const { parsedResumes, profilesCreated } = await ensureMissingAiProfiles(resumes);
  const prefs = parsePrefs(user.preferences);
  const pq = buildPersonalizedQuery(parsedResumes, prefs.preferredLocations);

  // Fetch personalized jobs from cheap/keyword-friendly sources
  const personalized = await fetchAndStorePersonalizedJobs(pq, { allowAdzuna: true });

  // Also run Apify LinkedIn with user-specific search queries
  let apify = { fetched: 0, upserted: 0, error: undefined as string | undefined };
  try {
    const apifyJobs = await runApifyManual({
      roles: pq.searchQueries.slice(0, 4),
      locations: [
        ...(pq.locations.length > 0 ? pq.locations : []),
        ...(parsedResumes[0]?.location ? [parsedResumes[0].location] : []),
      ].slice(0, 3),
    });
    const docs = enrichForUpsert(apifyJobs, 84);
    const upserted = await bulkUpsertJobs(docs);
    apify = { fetched: apifyJobs.length, upserted, error: undefined };
    await recordSourceHealth({
      source: LINKEDIN_APIFY_SOURCE,
      enabled: true,
      fetched: apifyJobs.length,
      normalized: docs.length,
      upserted,
    });
  } catch (e) {
    const details = errorToLog(e);
    apify = { fetched: 0, upserted: 0, error: details.message };
    await logAppEvent({
      level: "warn",
      kind: "job_source",
      source: "admin.refresh-user.apify",
      path: "/admin",
      userId,
      message: details.message,
      stack: details.stack,
    }).catch(() => {});
  }

  const email = await sendUserDigestEmail({
    user,
    resumes: parsedResumes.map((parsed) => ({ parsed })),
    jobs: await loadRecentDigestJobs(),
    force: true,
    minScore: 30,
  });

  return { userId, profilesCreated, personalized, apify, email };
}

async function loadUser(userId: string) {
  const db = getDb();
  const clauses: Record<string, unknown>[] = [{ id: userId }];
  if (ObjectId.isValid(userId)) clauses.push({ _id: new ObjectId(userId) });
  return (await db
    .collection<UserRow>("user")
    .findOne(
      { $or: clauses },
      { projection: { id: 1, _id: 1, email: 1, emailVerified: 1, name: 1, preferences: 1 } },
    )) as UserRow | null;
}

async function loadRefreshResumes(userId: string) {
  const active = await Resume.find({ userId, isActive: true, deletedAt: null })
    .sort({ updatedAt: -1 })
    .select({ parsed: 1, rawText: 1 })
    .lean();
  if (active.length > 0) return active;

  return Resume.find({ userId, deletedAt: null })
    .sort({ updatedAt: -1 })
    .limit(1)
    .select({ parsed: 1, rawText: 1 })
    .lean();
}

async function ensureMissingAiProfiles(
  resumes: Array<{ _id: unknown; parsed?: unknown; rawText?: string | null }>,
) {
  let profilesCreated = 0;
  const parsedResumes: ParsedResume[] = [];

  for (const resume of resumes) {
    const parsed = ParsedResumeSchema.parse(resume.parsed ?? {});
    if (hasUsableAiProfile(parsed)) {
      parsedResumes.push(parsed);
      continue;
    }

    try {
      const jobSearchProfile = await buildAiJobSearchProfile(parsed, resume.rawText ?? "");
      const nextParsed = { ...parsed, jobSearchProfile };
      await Resume.updateOne(
        { _id: resume._id },
        { $set: { parsed: nextParsed, parsedAt: new Date() } },
      );
      parsedResumes.push(nextParsed);
      profilesCreated++;
    } catch (e) {
      const details = errorToLog(e);
      await logAppEvent({
        kind: "resume",
        source: "admin.refresh-user.profile",
        message: details.message,
        stack: details.stack,
        meta: { resumeId: String(resume._id) },
      });
      parsedResumes.push(parsed);
    }
  }

  return { parsedResumes, profilesCreated };
}

function hasUsableAiProfile(resume: ParsedResume) {
  const profile = resume.jobSearchProfile;
  return (
    profile.source === "ai" &&
    !!profile.primaryRole &&
    (profile.targetTitles.length > 0 || profile.searchQueries.length > 0)
  );
}
