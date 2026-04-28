import { Building2, Globe, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { MatchResult } from "@/lib/match/score";
import { formatRelative, formatSalary } from "@/lib/utils";
import type { JobDoc } from "@/models/job";
import { ScoreDonut } from "./score-donut";

export function JobCard({ job, match }: { job: JobDoc; match: MatchResult }) {
  const salary = formatSalary(
    job.salary?.min,
    job.salary?.max,
    job.salary?.currency,
    job.salary?.period,
  );
  const matched = match.matchedSkills.slice(0, 5);
  const missing = match.missingSkills.slice(0, 3);
  const warning = match.reasons?.find(
    (r) => r.includes("unavailable") || r.includes("may be filled") || r.includes("ago"),
  );
  const positive = match.reasons?.find(
    (r) => r.startsWith("Matches") || r === "Recently posted.",
  );

  return (
    <Card className="w-full min-w-0 overflow-hidden p-3 transition-all hover:shadow-[var(--shadow-pop)] sm:p-4">
      {/* Row 1: score + title + date */}
      <div className="flex min-w-0 items-start gap-3">
        <div className="shrink-0 pt-0.5">
          <ScoreDonut value={match.score} size={40} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <h3
              className="min-w-0 flex-1 text-sm font-semibold leading-snug tracking-tight sm:text-base"
              style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
            >
              {job.title}
            </h3>
            <span className="ml-2 shrink-0 text-[11px] text-[var(--color-fg-subtle)]">
              {formatRelative(job.postedAt)}
            </span>
          </div>
          {/* Row 2: company · location */}
          <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-[var(--color-fg-muted)]">
            <Building2 className="h-3 w-3 shrink-0" />
            <span className="min-w-0 truncate font-medium">{job.company}</span>
            {job.location && (
              <>
                <span className="shrink-0 text-[var(--color-fg-subtle)]">·</span>
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="min-w-0 truncate">{job.location}</span>
              </>
            )}
            {job.remote && (
              <span className="ml-0.5 shrink-0 text-[var(--color-success)]">
                <Globe className="inline h-3 w-3" /> Remote
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: skills + source */}
      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1">
        {matched.map((s) => (
          <Badge key={s} variant="success" className="font-mono text-[10px]">
            {s}
          </Badge>
        ))}
        {missing.map((s) => (
          <Badge key={s} variant="outline" className="font-mono text-[10px] opacity-60">
            {s}
          </Badge>
        ))}
        <Badge variant="outline" className="ml-auto shrink-0 capitalize text-[10px]">
          {job.source}
        </Badge>
        {salary && (
          <span className="shrink-0 font-mono text-[11px] text-[var(--color-fg-muted)]">
            {salary}
          </span>
        )}
      </div>

      {/* Row 4: reason (1 line max) */}
      {(warning || positive) && (
        <p
          className={`mt-1.5 line-clamp-1 text-[11px] ${
            warning ? "text-[var(--color-warning)]" : "text-[var(--color-success)]"
          }`}
        >
          {warning ? `⚠ ${warning}` : `✓ ${positive}`}
        </p>
      )}
    </Card>
  );
}
