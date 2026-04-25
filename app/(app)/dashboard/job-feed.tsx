import Link from "next/link";
import { connectMongoose } from "@/lib/db";
import { Job } from "@/models/job";
import { Resume } from "@/models/resume";
import { score } from "@/lib/match/score";
import { JobCard } from "@/components/app/job-card";

export async function JobFeed({
  userId,
  resumeId,
  searchParams,
}: {
  userId: string;
  resumeId: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  await connectMongoose();
  const resume = await Resume.findById(resumeId).lean();
  if (!resume) return null;

  const q = (searchParams.q as string | undefined)?.trim();
  const remote = searchParams.remote === "1";
  const seniority = searchParams.seniority as string | undefined;

  const filter: Record<string, unknown> = {};
  if (remote) filter.remote = true;
  if (seniority) filter.seniority = seniority;
  if (q) filter.$text = { $search: q };

  const jobs = await Job.find(filter).sort({ postedAt: -1 }).limit(80).lean();

  if (jobs.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-subtle)] p-12 text-center">
        <p className="text-sm text-[var(--color-fg-muted)]">
          No jobs yet. Run the daily ingestion or wait for tomorrow's cron.
        </p>
      </div>
    );
  }

  const scored = jobs
    .map((j) => ({ job: j, m: score(resume.parsed as never, j as never) }))
    .sort((a, b) => b.m.score - a.m.score);

  return (
    <div className="grid gap-3">
      {scored.map(({ job, m }) => (
        <Link
          key={String(job._id)}
          href={`/jobs/${String(job._id)}`}
          className="block transition-transform hover:-translate-y-0.5"
        >
          <JobCard job={job as never} match={m} />
        </Link>
      ))}
      <p className="pt-2 text-center text-xs text-[var(--color-fg-subtle)]">
        Showing {scored.length} jobs · ranked by match score
      </p>
    </div>
  );
}
