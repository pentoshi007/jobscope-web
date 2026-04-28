import { createHash } from "node:crypto";
import { connectMongoose } from "@/lib/db";
import { AppLog } from "@/models/app-log";

type LogLevel = "error" | "warn" | "info";
type LogKind =
  | "error"
  | "rate_limit"
  | "cron"
  | "resume"
  | "api"
  | "job_source"
  | "client"
  | "email"
  | "runtime";

declare global {
  // eslint-disable-next-line no-var
  var _pendingAppLogs: AppLogInput[] | undefined;
}

const pendingLogs = global._pendingAppLogs ?? [];
global._pendingAppLogs = pendingLogs;
const MAX_PENDING_LOGS = 50;

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
  if (pendingLogs.length > 0) {
    await flushPendingLogs();
  }
  await writeLog(input).catch((e) => {
    queuePendingLog(input);
    console.error("[app-log] failed", e);
  });
}

async function writeLog(input: AppLogInput) {
  const now = new Date();
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
}

async function flushPendingLogs() {
  const batch = pendingLogs.splice(0, pendingLogs.length);
  for (const log of batch) {
    try {
      await writeLog(log);
    } catch {
      queuePendingLog(log);
      break;
    }
  }
}

function queuePendingLog(input: AppLogInput) {
  pendingLogs.push(input);
  if (pendingLogs.length > MAX_PENDING_LOGS) {
    pendingLogs.splice(0, pendingLogs.length - MAX_PENDING_LOGS);
  }
}

export function errorToLog(error: unknown) {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack ?? "" };
  }
  return { message: String(error), stack: "" };
}
