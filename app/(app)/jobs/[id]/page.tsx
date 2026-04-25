import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, ArrowLeft, Building2, MapPin } from "lucide-react";
import { connectMongoose } from "@/lib/db";
import { Job } from "@/models/job";
import { Resume } from "@/models/resume";
import { Application } from "@/models/application";
import { score } from "@/lib/match/score";
import { requireSession } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScoreDonut } from "@/components/app/score-donut";
import { JobActions } from "./job-actions";
import { AIHelpers } from "./ai-helpers";
import { formatRelative, formatSalary } from "@/lib/utils";

export default async function JobDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  await connectMongoose();
  const job = await Job.findById(id).lean();
  if (!job) notFound();

  const resumes = await Resume.find({
    userId: session.user.id,
    isActive: true,
    deletedAt: null,
  }).lean();

  // Score against all active resumes, pick the best match
  const matches = resumes.map((r) => score(r.parsed as never, job as never));
  const m = matches.length > 0
    ? matches.reduce((a, b) => (a.score >= b.score ? a : b))
    : score(undefined as never, job as never);
  const resume = resumes.length > 0 ? resumes[0] : null;

  const application = await Application.findOne({ userId: session.user.id, jobId: job._id }).lean();
  const salary = formatSalary(
    job.salary?.min,
    job.salary?.max,
    job.salary?.currency,
    job.salary?.period,
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
      >
        <ArrowLeft className="h-3 w-3" /> Back to dashboard
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <CardTitle className="text-xl">{job.title}</CardTitle>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--color-fg-muted)]">
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5" /> {job.company}
                    </span>
                    {job.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" /> {job.location}
                      </span>
                    )}
                    <span>· posted {formatRelative(job.postedAt)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {job.remote && <Badge variant="success">Remote</Badge>}
                    {job.seniority !== "unknown" && (
                      <Badge variant="outline" className="capitalize">
                        {job.seniority}
                      </Badge>
                    )}
                    <Badge variant="outline" className="capitalize">
                      {job.source}
                    </Badge>
                    {salary && <Badge variant="mono">{salary}</Badge>}
                  </div>
                </div>
                <ScoreDonut value={m.score} size={64} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-fg-muted)]">
                {job.description?.slice(0, 6000)}
              </div>
              <div className="mt-6 flex gap-2">
                <Button variant="accent" asChild>
                  <a href={job.url} target="_blank" rel="noopener noreferrer">
                    Apply on {job.source} <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          <AIHelpers jobId={String(job._id)} hasResume={!!resume} />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Match breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(m.breakdown).map(([k, v]) => (
                <Bar key={k} label={k} value={v} max={k === "skills" ? 50 : k === "seniority" ? 20 : k === "location" ? 15 : k === "experience" ? 10 : 5} />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Skills</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="mb-1 text-xs font-medium uppercase tracking-wider text-[var(--color-fg-subtle)]">
                  Matched ({m.matchedSkills.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {m.matchedSkills.length === 0 && (
                    <span className="text-xs text-[var(--color-fg-muted)]">none</span>
                  )}
                  {m.matchedSkills.map((s) => (
                    <Badge key={s} variant="success" className="font-mono text-[10px]">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs font-medium uppercase tracking-wider text-[var(--color-fg-subtle)]">
                  Missing ({m.missingSkills.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {m.missingSkills.length === 0 && (
                    <span className="text-xs text-[var(--color-fg-muted)]">none</span>
                  )}
                  {m.missingSkills.map((s) => (
                    <Badge key={s} variant="outline" className="font-mono text-[10px]">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <JobActions
            jobId={String(job._id)}
            currentStatus={application?.status ?? null}
            matchScore={m.score}
          />
        </div>
      </div>
    </div>
  );
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="capitalize text-[var(--color-fg-muted)]">{label}</span>
        <span className="font-mono tabular-nums">
          {value}/{max}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
        <div
          className="h-full rounded-full bg-[var(--color-accent)] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
