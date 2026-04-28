import { connectMongoose } from "@/lib/db";
import { JobSourceHealth } from "@/models/job-source-health";

export interface SourceHealthUpdate {
  source: string;
  enabled?: boolean;
  fetched?: number;
  normalized?: number;
  upserted?: number;
  skipped?: number;
  failed?: number;
  durationMs?: number;
  error?: string;
  cooldownUntil?: Date | null;
}

export async function recordSourceHealth(update: SourceHealthUpdate) {
  const now = new Date();
  await connectMongoose();
  const failed = (update.failed ?? 0) > 0 || Boolean(update.error);
  await JobSourceHealth.updateOne(
    { source: update.source },
    {
      $setOnInsert: { source: update.source },
      $set: {
        enabled: update.enabled ?? true,
        fetched: update.fetched ?? 0,
        normalized: update.normalized ?? 0,
        upserted: update.upserted ?? 0,
        skipped: update.skipped ?? 0,
        failed: update.failed ?? (failed ? 1 : 0),
        durationMs: update.durationMs ?? 0,
        lastRunAt: now,
        ...(failed
          ? { lastErrorAt: now, lastError: update.error?.slice(0, 500) ?? "source failed" }
          : { lastSuccessAt: now, lastError: "" }),
        cooldownUntil: update.cooldownUntil ?? null,
      },
    },
    { upsert: true },
  );
}
