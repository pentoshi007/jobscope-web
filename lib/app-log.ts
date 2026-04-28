import { createHash } from "node:crypto";
import { connectMongoose } from "@/lib/db";
import { AppLog } from "@/models/app-log";

type LogLevel = "error" | "warn" | "info";
type LogKind = "error" | "rate_limit" | "cron" | "resume" | "api";

export interface AppLogInput {
  level?: LogLevel;
  kind?: LogKind;
  message: string;
  source?: string;
  path?: string;
  userId?: string;
  status?: number;
  stack?: string;
  meta?: Record<string, unknown>;
}

function fingerprint(input: AppLogInput) {
  return createHash("sha256")
    .update(
      [
        input.kind ?? "error",
        input.source ?? "",
        input.path ?? "",
        input.status ?? "",
        input.message.slice(0, 500),
      ].join("|"),
    )
    .digest("hex");
}

export async function logAppEvent(input: AppLogInput) {
  const now = new Date();
  try {
    await connectMongoose();
    await AppLog.updateOne(
      { fingerprint: fingerprint(input) },
      {
        $setOnInsert: {
          level: input.level ?? "error",
          kind: input.kind ?? "error",
          message: input.message,
          source: input.source ?? "",
          path: input.path ?? "",
          userId: input.userId ?? "",
          status: input.status ?? null,
          stack: input.stack ?? "",
          firstSeenAt: now,
          seen: false,
        },
        $set: {
          lastSeenAt: now,
          meta: input.meta ?? {},
          seen: false,
        },
        $inc: { count: 1 },
      },
      { upsert: true },
    );
  } catch (e) {
    console.error("[app-log] failed", e);
  }
}

export function errorToLog(error: unknown) {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack ?? "" };
  }
  return { message: String(error), stack: "" };
}
