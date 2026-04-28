import { errorToLog, logAppEvent } from "@/lib/app-log";

export interface SafeFetchOptions extends RequestInit {
  source: string;
  label?: string;
  timeoutMs?: number;
  maxBytes?: number;
  logPath?: string;
  quietStatuses?: number[];
  meta?: Record<string, unknown>;
}

export class SafeFetchError extends Error {
  status?: number;
  retryAfterMs?: number;

  constructor(message: string, opts: { status?: number; retryAfterMs?: number } = {}) {
    super(message);
    this.name = "SafeFetchError";
    this.status = opts.status;
    this.retryAfterMs = opts.retryAfterMs;
  }
}

export async function safeFetchText(url: string, opts: SafeFetchOptions) {
  const {
    source,
    label,
    timeoutMs: timeoutOverride,
    maxBytes: maxByteOverride,
    logPath,
    quietStatuses,
    meta,
    ...init
  } = opts;
  const timeoutMs = timeoutOverride ?? 12_000;
  const maxBytes = maxByteOverride ?? 1_500_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();

  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "User-Agent": "JobScope/1.0",
        ...(init.headers ?? {}),
      },
    });

    const retryAfterMs = parseRetryAfter(res.headers.get("retry-after"));
    if (!res.ok) {
      throw new SafeFetchError(`${source} ${label ?? "request"} failed: ${res.status}`, {
        status: res.status,
        retryAfterMs,
      });
    }

    const contentLength = Number(res.headers.get("content-length") ?? 0);
    if (contentLength > maxBytes) {
      throw new SafeFetchError(`${source} response too large`, { status: res.status });
    }

    const text = await res.text();
    if (Buffer.byteLength(text, "utf8") > maxBytes) {
      throw new SafeFetchError(`${source} response exceeded byte budget`, {
        status: res.status,
      });
    }
    return text;
  } catch (error) {
    const details = errorToLog(error);
    const status = error instanceof SafeFetchError ? error.status : undefined;
    if (!status || !quietStatuses?.includes(status)) {
      await logAppEvent({
        kind: status === 429 ? "rate_limit" : "job_source",
        source: `jobs.${source}`,
        path: logPath ?? "/api/cron/fetch-jobs",
        status,
        message: details.message,
        stack: details.stack,
        meta: {
          label,
          durationMs: Date.now() - started,
          retryAfterMs: error instanceof SafeFetchError ? error.retryAfterMs : undefined,
          ...meta,
        },
      });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function safeFetchJson<T>(url: string, opts: SafeFetchOptions): Promise<T> {
  const text = await safeFetchText(url, opts);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new SafeFetchError(`${opts.source} returned invalid JSON`);
  }
}

function parseRetryAfter(value: string | null) {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const date = new Date(value).getTime();
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}
