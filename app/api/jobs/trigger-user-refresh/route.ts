import { type NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getAdminSession } from "@/lib/admin";
import { errorToLog, logAppEvent } from "@/lib/app-log";
import { connectMongoose, getDb } from "@/lib/db";
import { env } from "@/lib/env";
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

export const runtime = "nodejs";
export const maxDuration = 180;

type UserRow = {
  id?: unknown;
  _id?: unknown;
  email?: string | null;
  emailVerified?: boolean | null;
  name?: string | null;
  preferences?: string | null;
};

function sse(ctrl: ReadableStreamDefaultController, event: string, data: Record<string, unknown>) {
  ctrl.enqueue(
    new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
  );
}

async function authorize(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret");
  if (secret === env.CRON_SECRET) return true;
  const admin = await getAdminSession();
  return Boolean(admin);
}

export async function POST(req: NextRequest) {
  if (!(await authorize(req))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { userId } = (await req.json().catch(() => ({}))) as { userId?: string };
  if (!userId) return NextResponse.json({ ok: false, error: "Missing userId" }, { status: 400 });

  const stream = new ReadableStream({
    async start(ctrl) {
      const closed = { v: false };
      const send = (event: string, data: Record<string, unknown>) => {
        if (closed.v) return;
        try { sse(ctrl, event, data); } catch { closed.v = true; }
      };

      try {
        send("status", { phase: "starting", msg: "Connecting to database…" });
        await connectMongoose();

        const db = getDb();
        const clauses: Record<string, unknown>[] = [{ id: userId }];
        if (ObjectId.isValid(userId)) clauses.push({ _id: new ObjectId(userId) });
        const user = (await db.collection<UserRow>("user").findOne(
          { $or: clauses },
          { projection: { id: 1, _id: 1, email: 1, emailVerified: 1, name: 1, preferences: 1 } },
        )) as UserRow | null;
        if (!user) { send("done", { ok: false, error: "User not found" }); ctrl.close(); return; }

        const resumes = await Resume.find({ userId, isActive: true, deletedAt: null })
          .sort({ updatedAt: -1 }).select({ parsed: 1, rawText: 1 }).lean();
        if (resumes.length === 0) { send("done", { ok: false, error: "No active resume" }); ctrl.close(); return; }

        send("status", { phase: "profile", msg: "Building AI job search profile…" });
        let profilesCreated = 0;
        const parsedResumes: ParsedResume[] = [];
        for (const resume of resumes) {
          const parsed = ParsedResumeSchema.parse(resume.parsed ?? {});
          const has = parsed.jobSearchProfile?.source === "ai" &&
            !!parsed.jobSearchProfile?.primaryRole &&
            (parsed.jobSearchProfile?.targetTitles?.length > 0 || parsed.jobSearchProfile?.searchQueries?.length > 0);
          if (has) { parsedResumes.push(parsed); continue; }
          try {
            const jobSearchProfile = await buildAiJobSearchProfile(parsed, (resume as { rawText?: string | null }).rawText ?? "");
            const next = { ...parsed, jobSearchProfile };
            await Resume.updateOne({ _id: resume._id }, { $set: { parsed: next, parsedAt: new Date() } });
            parsedResumes.push(next);
            profilesCreated++;
          } catch { parsedResumes.push(parsed); }
        }

        const prefs = parsePrefs(user.preferences);
        const pq = buildPersonalizedQuery(parsedResumes, prefs.preferredLocations);

        send("status", { phase: "personalized", msg: `Fetching jobs for: ${pq.searchQueries.slice(0, 3).join(", ") || pq.primaryRole}...` });
        const personalized = await fetchAndStorePersonalizedJobs(pq, { allowAdzuna: true });
        const pFetched = Object.values(personalized).reduce((s, v) => s + v.fetched, 0);
        send("status", { phase: "personalized-done", msg: `Fetched ${pFetched} personalized jobs` });

        send("status", { phase: "apify", msg: "Starting LinkedIn Apify scrape…" });
        let apify = { fetched: 0, upserted: 0, error: undefined as string | undefined };
        try {
          const apifyJobs = await runApifyManual({
            roles: pq.searchQueries.slice(0, 4),
            locations: [
              ...(pq.locations.length > 0 ? pq.locations : []),
              ...(parsedResumes[0]?.location ? [parsedResumes[0].location] : []),
            ].slice(0, 3),
            onProgress: (msg) => send("status", { phase: "apify-progress", msg }),
          });
          const docs = enrichForUpsert(apifyJobs, 84);
          const upserted = await bulkUpsertJobs(docs);
          apify = { fetched: apifyJobs.length, upserted, error: undefined };
          await recordSourceHealth({ source: LINKEDIN_APIFY_SOURCE, enabled: true, fetched: apifyJobs.length, normalized: docs.length, upserted });
          send("status", { phase: "apify-done", msg: `LinkedIn: ${apifyJobs.length} fetched, ${upserted} saved` });
        } catch (e) {
          const d = errorToLog(e);
          apify = { fetched: 0, upserted: 0, error: d.message };
          await logAppEvent({ level: "warn", kind: "job_source", source: "admin.refresh-user.apify", path: "/admin", userId, message: d.message, stack: d.stack }).catch(() => {});
          send("status", { phase: "apify-error", msg: `LinkedIn error: ${d.message.slice(0, 80)}` });
        }

        send("status", { phase: "email", msg: "Sending match digest email…" });
        const email = await sendUserDigestEmail({
          user,
          resumes: parsedResumes.map((p) => ({ parsed: p })),
          jobs: await loadRecentDigestJobs(),
          force: true,
          minScore: 30,
        });
        const emailMsg = email.status === "sent" ? `Email sent: ${email.count} matches` : `Email skipped (${email.reason})`;
        send("status", { phase: "email-done", msg: emailMsg });

        send("done", { ok: true, profilesCreated, personalized, apify, email });
      } catch (e) {
        const d = errorToLog(e);
        send("done", { ok: false, error: d.message });
      } finally {
        try { ctrl.close(); } catch { /* already closed */ }
        closed.v = true;
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
