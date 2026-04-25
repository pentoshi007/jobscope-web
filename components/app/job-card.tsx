import { MapPin, Building2, Globe } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreDonut } from "./score-donut";
import { formatRelative, formatSalary } from "@/lib/utils";
import type { JobDoc } from "@/models/job";
import type { MatchResult } from "@/lib/match/score";

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
    <Card className="flex items-center gap-5 p-5 transition-all hover:shadow-[var(--shadow-pop)]">
      <ScoreDonut value={match.score} size={56} />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h3 className="truncate text-base font-semibold tracking-tight">{job.title}</h3>
          <span className="text-xs text-[var(--color-fg-subtle)]">·</span>
          <span className="text-sm text-[var(--color-fg-muted)]">
            {formatRelative(job.postedAt)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-fg-muted)]">
          <span className="inline-flex items-center gap-1">
            <Building2 className="h-3 w-3" /> {job.company}
          </span>
          {job.location && (
            <span className="inline-flex items-center gap-1">
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
      </div>
    </Card>
  );
}
