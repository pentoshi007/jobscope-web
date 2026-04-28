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

  return (
    <Card className="flex min-w-0 overflow-hidden items-start gap-3 p-3 transition-all hover:shadow-[var(--shadow-pop)] sm:items-center sm:gap-5 sm:p-5">
      <div className="shrink-0">
        <ScoreDonut value={match.score} size={44} />
      </div>
      <div className="min-w-0 flex-1 space-y-1.5 sm:space-y-2">
        <div className="flex min-w-0 items-baseline gap-x-2 gap-y-0.5">
          <h3 className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight sm:text-base">
            {job.title}
          </h3>
          <span className="shrink-0 text-xs text-[var(--color-fg-muted)] sm:text-sm">
            {formatRelative(job.postedAt)}
          </span>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-fg-muted)]">
          <span className="inline-flex min-w-0 max-w-[40%] shrink items-center gap-1 truncate sm:max-w-none">
            <Building2 className="h-3 w-3 shrink-0" />
            <span className="truncate">{job.company}</span>
          </span>
          {job.location && (
            <span className="inline-flex min-w-0 max-w-[45%] shrink items-center gap-1 truncate sm:max-w-none">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{job.location}</span>
            </span>
          )}
          {job.remote && (
            <span className="inline-flex shrink-0 items-center gap-1 text-[var(--color-success)]">
              <Globe className="h-3 w-3" /> Remote
            </span>
          )}
          {salary && <span className="shrink-0 font-mono">{salary}</span>}
          <Badge variant="outline" className="shrink-0 capitalize">
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
      </div>
    </Card>
  );
}
