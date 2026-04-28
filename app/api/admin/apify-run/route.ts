import { type NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { errorToLog, logAppEvent } from "@/lib/app-log";
import { connectMongoose, getDb } from "@/lib/db";
import { enrichForUpsert, bulkUpsertJobs } from "@/lib/jobs/ingest/runner";
import { runApifyManual } from "@/lib/jobs/ingest/apify-linkedin";
import { buildPersonalizedQuery } from "@/lib/jobs/personalized";
import { LINKEDIN_APIFY_SOURCE } from "@/lib/jobs/source-constants";
import { recordSourceHealth } from "@/lib/jobs/source-health";
import { parsePrefs } from "@/lib/preferences";
import { type ParsedResume, ParsedResumeSchema } from "@/lib/resume/schema";
import { Resume } from "@/models/resume";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/admin/apify-run
 *
 * Loads every active user's profile, builds personalised LinkedIn search
 * URLs, starts an Apify actor run, waits for completion, then upserts.
 * Streams SSE progress to the admin UI.
 */
export async function POST(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const closed = { value: false };
      function send(event: string, data: Record<string, unknown>) {
        if (closed.value) return;
        try {
          controller.enqueue(
            new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          closed.value = true;
        }
      }

      try {
        await connectMongoose();
        send("status", { phase: "loading", message: "Loading user profiles…" });

        // ── Gather search context from all active users ──────────
        const { roles, locations } = await gatherUserSearchContext();

        if (roles.length === 0) {
          send("done", {
            ok: false,
            error: "No active user profiles found to derive search queries.",
            message: "No active user profiles found. Upload a resume first.",
          });
          return;
        }

        send("status", {
          phase: "starting",
          message: `Found ${roles.length} search roles and ${locations.length} locations from user profiles.`,
        });

        const started = Date.now();
        const jobs = await runApifyManual({
          roles,
          locations,
          onProgress: (msg) => send("status", { phase: "running", message: msg }),
        });

        send("status", {
          phase: "upserting",
          message: `Normalised ${jobs.length} jobs. Upserting…`,
        });

        const docs = enrichForUpsert(jobs, 84);
        const upserted = await bulkUpsertJobs(docs);
        const durationMs = Date.now() - started;

        await recordSourceHealth({
          source: LINKEDIN_APIFY_SOURCE,
          enabled: true,
          fetched: jobs.length,
          normalized: docs.length,
          upserted,
          durationMs,
        });

        send("done", {
          ok: true,
          fetched: jobs.length,
          upserted,
          durationMs,
          message: `Done! Fetched ${jobs.length} jobs, upserted ${upserted} in ${(durationMs / 1000).toFixed(1)}s.`,
        });
      } catch (e) {
        const details = errorToLog(e);
        await logAppEvent({
          level: "error",
          kind: "api",
          source: "admin.apify-run",
          path: "/api/admin/apify-run",
          message: details.message,
          stack: details.stack,
          meta: { admin: admin.email },
        }).catch(() => {});

        send("done", {
          ok: false,
          error: details.message,
          message: `Error: ${details.message}`,
        });
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
        closed.value = true;
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

// ─── helpers ─────────────────────────────────────────────────────────

async function gatherUserSearchContext() {
  const resumes = await Resume.find({ isActive: true, deletedAt: null })
    .sort({ updatedAt: -1 })
    .limit(50)
    .select({ userId: 1, parsed: 1 })
    .lean();

  const db = getDb();
  const users = await db
    .collection("user")
    .find(
      { id: { $in: resumes.map((r) => r.userId) } },
      { projection: { id: 1, preferences: 1 } },
    )
    .toArray();
  const prefsByUser = new Map(
    users.map((u) => [String(u.id), safePreferredLocations(u.preferences)]),
  );

  const allRoles = new Set<string>();
  const allLocations = new Set<string>();

  for (const resume of resumes) {
    const parsed = ParsedResumeSchema.safeParse(resume.parsed);
    if (!parsed.success) continue;

    const userPrefs = prefsByUser.get(resume.userId) ?? [];
    const pq = buildPersonalizedQuery([parsed.data], userPrefs);

    // Collect unique roles and locations from the user's search profile
    for (const q of pq.searchQueries) allRoles.add(q);
    if (pq.primaryRole) allRoles.add(pq.primaryRole);
    for (const loc of pq.locations) allLocations.add(loc);
    if (parsed.data.location) allLocations.add(parsed.data.location);
  }

  return {
    roles: [...allRoles].filter(Boolean).slice(0, 8),
    locations: [...allLocations].filter(Boolean).slice(0, 6),
  };
}

function safePreferredLocations(raw: unknown) {
  try {
    const prefs = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(prefs?.preferredLocations) ? prefs.preferredLocations : [];
  } catch {
    return [];
  }
}
