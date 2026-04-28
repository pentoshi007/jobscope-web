"use client";
import { Building2, Globe, Loader2, MapPin, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScoreDonut } from "@/components/app/score-donut";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatRelative, formatSalary } from "@/lib/utils";

interface StreamJob {
  id: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  seniority?: string;
  source: string;
  url: string;
  postedAt: string;
  salary: {
    min: number | null;
    max: number | null;
    currency: string | null;
    period: string | null;
  } | null;
  match: {
    score: number;
    matchedSkills: string[];
    missingSkills: string[];
    reasons?: string[];
  };
}

type Phase =
  | "idle"
  | "starting"
  | "scoring"
  | "fetching"
  | "source-done"
  | "source-error"
  | "source-empty"
  | "cooldown"
  | "done"
  | "error";

const SOURCE_LABEL: Record<string, string> = {
  cached: "your library",
  remotive: "Remotive",
  jooble: "Jooble",
  adzuna: "Adzuna",
};

// Session-level cache: persists across mounts while the tab is alive.
// Avoids re-fetching when the user navigates away and comes back.
let _cachedJobs: StreamJob[] | null = null;
let _cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function StreamingFeed() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [jobs, setJobs] = useState<StreamJob[]>(_cachedJobs ?? []);
  const [phase, setPhase] = useState<Phase>(
    _cachedJobs && Date.now() - _cachedAt < CACHE_TTL_MS ? "done" : "idle",
  );
  const [statusMsg, setStatusMsg] = useState<string>(
    _cachedJobs && Date.now() - _cachedAt < CACHE_TTL_MS
      ? `${_cachedJobs.length} matches ready`
      : "",
  );
  const [keywords, setKeywords] = useState<string[]>([]);
  const [activeSources, setActiveSources] = useState<Set<string>>(new Set());
  const ctrlRef = useRef<AbortController | null>(null);
  const hasRunRef = useRef(false);

  const handleSseBlock = useCallback((block: string) => {
    let event = "message";
    const dataLines: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(dataLines.join("\n") || "{}");
    } catch {
      return;
    }
    if (event === "status") {
      const p = data.phase as Phase | undefined;
      if (p) setPhase(p);
      if (p === "starting") {
        const q = (data.query as { keywords?: string[]; role?: string } | undefined) ?? {};
        if (q.keywords?.length) setKeywords(q.keywords);
        setStatusMsg("Loading stored matches...");
      } else if (p === "scoring") {
        setStatusMsg(`Scoring ${(data.count as number) ?? 0} stored jobs...`);
      } else if (p === "fetching") {
        setStatusMsg("Reaching out to job boards for fresh matches...");
        setActiveSources(new Set(["remotive", "jooble"]));
      } else if (p === "source-done") {
        const src = data.source as string;
        setActiveSources((prev) => {
          const n = new Set(prev);
          n.delete(src);
          return n;
        });
        setStatusMsg(`${SOURCE_LABEL[src] ?? src} — added ${(data.added as number) ?? 0}`);
      } else if (p === "source-error" || p === "source-empty") {
        const src = data.source as string;
        setActiveSources((prev) => {
          const n = new Set(prev);
          n.delete(src);
          return n;
        });
      } else if (p === "cooldown") {
        setStatusMsg((data.message as string) || "Cooling down to stay within free limits.");
      } else if (p === "error") {
        setStatusMsg((data.message as string) || "Something went wrong.");
      }
    } else if (event === "jobs") {
      const incoming = (data.jobs as StreamJob[]) ?? [];
      setJobs((prev) => {
        const merged = mergeJobs(prev, incoming);
        // Update session cache
        _cachedJobs = merged;
        _cachedAt = Date.now();
        return merged;
      });
    } else if (event === "done") {
      setPhase("done");
      const fetched = (data.fetched as number) ?? 0;
      setStatusMsg(
        fetched > 0 ? `Done. ${fetched} fresh matches added.` : "Done. Showing stored matches.",
      );
      setActiveSources(new Set());
    }
  }, []);

  const start = useCallback(() => {
    if (ctrlRef.current) ctrlRef.current.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setJobs([]);
    setPhase("starting");
    setStatusMsg("Starting up...");
    setActiveSources(new Set());

    fetch("/api/jobs/refresh", { signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok || !res.body) {
          setPhase("error");
          setStatusMsg(`HTTP ${res.status}`);
          return;
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let idx = buf.indexOf("\n\n");
          while (idx !== -1) {
            const block = buf.slice(0, idx).trim();
            buf = buf.slice(idx + 2);
            if (block) handleSseBlock(block);
            idx = buf.indexOf("\n\n");
          }
        }
        setPhase("done");
      })
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        setPhase("error");
        setStatusMsg(e instanceof Error ? e.message : "stream failed");
      });
  }, [handleSseBlock]);

  // Only auto-fetch on the very first mount if there's no cached data.
  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    // If we have fresh cached data, skip the fetch
    if (_cachedJobs && Date.now() - _cachedAt < CACHE_TTL_MS) return;

    start();

    const next = new URLSearchParams(window.location.search);
    if (next.get("refresh")) {
      next.delete("refresh");
      router.replace(`${pathname}${next.toString() ? `?${next.toString()}` : ""}`);
    }
    return () => {
      ctrlRef.current?.abort();
    };
  }, [pathname, router, start]);

  const isRunning =
    phase !== "done" && phase !== "idle" && phase !== "error" && phase !== "cooldown";

  // Apply URL filters client-side (search query, remote-only, seniority).
  const q = (sp.get("q") ?? "").trim().toLowerCase();
  const remoteOnly = sp.get("remote") === "1";
  const seniorityFilter = sp.get("seniority") ?? "";
  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      if (remoteOnly && !j.remote) return false;
      if (seniorityFilter && j.seniority !== seniorityFilter) return false;
      if (q) {
        const hay = `${j.title} ${j.company}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [jobs, q, remoteOnly, seniorityFilter]);

  const sortedJobs = useMemo(
    () => [...filtered].sort((a, b) => b.match.score - a.match.score),
    [filtered],
  );

  return (
    <div className="space-y-4">
      <StatusBar
        phase={phase}
        message={statusMsg}
        keywords={keywords}
        sources={activeSources}
        count={filtered.length}
        onRetry={start}
        running={isRunning}
      />
      {sortedJobs.length === 0 && !isRunning ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-subtle)] p-12 text-center">
          <p className="text-sm text-[var(--color-fg-muted)]">
            {jobs.length === 0
              ? "No matches yet. Try editing your resume's headline or skills, then refresh."
              : "No jobs match these filters. Clear them or try a different search."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {sortedJobs.map((j) => (
            <Link
              key={j.id}
              href={`/jobs/${j.id}`}
              className="block transition-transform hover:-translate-y-0.5"
            >
              <StreamCard job={j} />
            </Link>
          ))}
          {phase === "done" && jobs.length > 0 && (
            <p className="pt-2 text-center text-xs text-[var(--color-fg-subtle)]">
              Showing {sortedJobs.length} of {jobs.length} match{jobs.length === 1 ? "" : "es"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function mergeJobs(prev: StreamJob[], incoming: StreamJob[]): StreamJob[] {
  if (incoming.length === 0) return prev;
  const map = new Map(prev.map((j) => [j.id, j]));
  let changed = false;
  for (const j of incoming) {
    const existing = map.get(j.id);
    if (!existing || j.match.score > existing.match.score) {
      map.set(j.id, j);
      changed = true;
    }
  }
  if (!changed) return prev;
  return [...map.values()];
}

function StatusBar({
  phase,
  message,
  keywords,
  sources,
  count,
  onRetry,
  running,
}: {
  phase: Phase;
  message: string;
  keywords: string[];
  sources: Set<string>;
  count: number;
  onRetry: () => void;
  running: boolean;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {running ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--color-accent)]" />
          ) : phase === "done" ? (
            <Sparkles className="h-4 w-4 shrink-0 text-[var(--color-accent)]" />
          ) : (
            <RefreshCw className="h-4 w-4 shrink-0 text-[var(--color-fg-muted)]" />
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">
              {phase === "done"
                ? `${count} match${count === 1 ? "" : "es"} ready`
                : phase === "error"
                  ? "Couldn't refresh"
                  : message || "Idle"}
            </div>
            {keywords.length > 0 && (
              <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-[var(--color-fg-subtle)]">
                <span>Searching:</span>
                {keywords.map((k) => (
                  <span
                    key={k}
                    className="rounded-full bg-[var(--color-card)] px-1.5 py-0.5 font-mono"
                  >
                    {k}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {sources.size > 0 && (
            <span className="hidden text-[11px] text-[var(--color-fg-subtle)] sm:inline">
              {[...sources].map((s) => SOURCE_LABEL[s] ?? s).join(", ")}…
            </span>
          )}
          <Button variant="outline" size="sm" onClick={onRetry} disabled={running} className="h-8">
            <RefreshCw className={`h-3.5 w-3.5 ${running ? "animate-spin" : ""}`} />
            {running ? "Working" : "Refresh"}
          </Button>
        </div>
      </div>
    </div>
  );
}

const StreamCard = memo(function StreamCard({ job }: { job: StreamJob }) {
  const salary = formatSalary(
    job.salary?.min ?? null,
    job.salary?.max ?? null,
    job.salary?.currency ?? null,
    job.salary?.period ?? null,
  );
  const matched = job.match.matchedSkills.slice(0, 5);
  const missing = job.match.missingSkills.slice(0, 3);
  const reasons = job.match.reasons ?? [];

  // Categorise reasons for display
  const warnings = reasons.filter(
    (r) => r.includes("unavailable") || r.includes("may be filled") || r.includes("ago"),
  );
  const positives = reasons.filter(
    (r) => r.startsWith("Matches") || r === "Recently posted.",
  );
  const neutrals = reasons.filter(
    (r) => !warnings.includes(r) && !positives.includes(r),
  );

  return (
    <Card className="flex min-w-0 items-start gap-3 p-3 transition-all hover:shadow-[var(--shadow-pop)] sm:items-center sm:gap-5 sm:p-5">
      <div className="shrink-0">
        <ScoreDonut value={job.match.score} size={48} />
      </div>
      <div className="min-w-0 flex-1 space-y-1.5 sm:space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h3 className="min-w-0 max-w-full truncate text-sm font-semibold tracking-tight sm:text-base">
            {job.title}
          </h3>
          <span className="hidden text-xs text-[var(--color-fg-subtle)] sm:inline">·</span>
          <span className="shrink-0 text-xs text-[var(--color-fg-muted)] sm:text-sm">
            {formatRelative(new Date(job.postedAt))}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-fg-muted)]">
          <span className="inline-flex min-w-0 items-center gap-1">
            <Building2 className="h-3 w-3" /> {job.company}
          </span>
          {job.location && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin className="h-3 w-3" /> {job.location}
            </span>
          )}
          {job.remote && (
            <span className="inline-flex items-center gap-1 text-[var(--color-success)]">
              <Globe className="h-3 w-3" /> Remote
            </span>
          )}
          {salary && <span className="font-mono">{salary}</span>}
          <Badge variant="outline" className="capitalize">
            {job.source}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {matched.map((s) => (
            <Badge key={s} variant="success" className="font-mono text-[10px]">
              {s}
            </Badge>
          ))}
          {missing.map((s) => (
            <Badge key={s} variant="outline" className="font-mono text-[10px] opacity-70">
              {s}
            </Badge>
          ))}
        </div>
        {(warnings.length > 0 || positives.length > 0 || neutrals.length > 0) && (
          <div className="space-y-0.5 text-xs">
            {warnings.map((r, i) => (
              <p key={`w-${i}`} className="text-[var(--color-warning)]">⚠ {r}</p>
            ))}
            {positives.map((r, i) => (
              <p key={`p-${i}`} className="text-[var(--color-success)]">✓ {r}</p>
            ))}
            {neutrals.map((r, i) => (
              <p key={`n-${i}`} className="text-[var(--color-fg-muted)]">• {r}</p>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
});
