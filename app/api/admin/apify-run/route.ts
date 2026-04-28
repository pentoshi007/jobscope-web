import { type NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { errorToLog, logAppEvent } from "@/lib/app-log";
import { connectMongoose } from "@/lib/db";
import { enrichForUpsert, bulkUpsertJobs } from "@/lib/jobs/ingest/runner";
import { runApifyManual } from "@/lib/jobs/ingest/apify-linkedin";
import { LINKEDIN_APIFY_SOURCE } from "@/lib/jobs/source-constants";
import { recordSourceHealth } from "@/lib/jobs/source-health";

export const runtime = "nodejs";
// No maxDuration – let the manual run go as long as needed.
// Vercel Pro/Enterprise can go up to 300s; hobby stays at 60s.
export const maxDuration = 300;

/**
 * POST /api/admin/apify-run
 *
 * Starts an Apify LinkedIn actor, waits for completion (no deadline),
 * then fetches and upserts the dataset. Streams SSE progress to the
 * admin UI.
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
        send("status", { phase: "starting", message: "Starting Apify LinkedIn actor…" });

        const started = Date.now();
        const jobs = await runApifyManual((msg) => {
          send("status", { phase: "running", message: msg });
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
