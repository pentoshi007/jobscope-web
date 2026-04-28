import { connectMongoose } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Application } from "@/models/application";
import { Job } from "@/models/job";
import { KanbanBoard } from "./kanban";
import { Stats } from "./stats";

export const metadata = { title: "Tracker" };

export default async function ApplicationsPage() {
  const session = await requireSession();
  await connectMongoose();
  const apps = await Application.find({ userId: session.user.id })
    .sort({ updatedAt: -1 })
    .select({ jobId: 1, status: 1, notes: 1, appliedAt: 1, matchScoreSnapshot: 1, createdAt: 1 })
    .lean();
  const jobIds = apps.map((a) => a.jobId);
  const jobs = jobIds.length
    ? await Job.find({ _id: { $in: jobIds } })
        .select({ title: 1, company: 1, location: 1, url: 1, source: 1 })
        .lean()
    : [];
  const jobMap = new Map(jobs.map((j) => [String(j._id), j]));

  const cards = apps
    .map((a) => {
      const j = jobMap.get(String(a.jobId));
      if (!j) return null;
      return {
        id: String(a._id),
        jobId: String(a.jobId),
        status: a.status as "saved" | "applied" | "interview" | "offer" | "rejected",
        notes: a.notes ?? "",
        score: a.matchScoreSnapshot ?? 0,
        title: j.title,
        company: j.company,
        location: j.location ?? "",
        url: j.url,
        source: j.source,
      };
    })
    .filter(Boolean) as NonNullable<ReturnType<typeof toCard>>[];

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Application tracker</h1>
        <p className="text-sm text-[var(--color-fg-muted)]">
          Drag cards across columns. Status changes auto-save.
        </p>
      </div>
      <Stats apps={apps as never} />
      <KanbanBoard initial={cards} />
    </div>
  );
}

function toCard() {
  return null as unknown as {
    id: string;
    jobId: string;
    status: "saved" | "applied" | "interview" | "offer" | "rejected";
    notes: string;
    score: number;
    title: string;
    company: string;
    location: string;
    url: string;
    source: string;
  };
}
