import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { connectMongoose } from "@/lib/db";
import { Resume } from "@/models/resume";
import { requireSession } from "@/lib/session";
import { ResumeEditor } from "./editor";
import { atsScore } from "@/lib/resume/ats";
import { normalizeParsedResume } from "@/lib/resume/schema";
import { ScoreDonut } from "@/components/app/score-donut";
import { Badge } from "@/components/ui/badge";

export default async function ResumeDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  await connectMongoose();
  const r = await Resume.findOne({ _id: id, userId: session.user.id, deletedAt: null }).lean();
  if (!r) notFound();

  // Normalize parsed through Zod schema to ensure all fields have safe defaults
  const parsed = normalizeParsedResume(r.parsed);
  const ats = atsScore(parsed, r.rawText ?? "");

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/resumes"
            className="inline-flex items-center gap-1 text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            <ArrowLeft className="h-3 w-3" /> All resumes
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{r.name}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-[var(--color-fg-muted)]">
            {r.isActive && <Badge variant="accent">Active</Badge>}
            <span>{r.parsed?.fullName}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3">
          <ScoreDonut value={ats.score} size={48} />
          <div>
            <div className="text-xs uppercase tracking-wider text-[var(--color-fg-subtle)]">
              ATS score
            </div>
            <div className="text-sm text-[var(--color-fg-muted)]">
              {ats.score >= 80 ? "Excellent" : ats.score >= 60 ? "Good" : "Needs work"}
            </div>
          </div>
        </div>
      </div>

      <ResumeEditor
        id={String(r._id)}
        isActive={Boolean(r.isActive)}
        parsed={parsed}
      />
    </div>
  );
}
