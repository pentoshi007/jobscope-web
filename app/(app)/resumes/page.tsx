import Link from "next/link";
import { FileText, Star } from "lucide-react";
import { connectMongoose } from "@/lib/db";
import { Resume } from "@/models/resume";
import { requireSession } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResumeUploader } from "./uploader";
import { formatRelative } from "@/lib/utils";

export const metadata = { title: "Resumes" };

export default async function ResumesPage() {
  const session = await requireSession();
  await connectMongoose();
  const resumes = await Resume.find({ userId: session.user.id, deletedAt: null })
    .sort({ createdAt: -1 })
    .lean();

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Resumes</h1>
        <p className="text-sm text-[var(--color-fg-muted)]">
          Upload as many as you want. Mark multiple as active to match different job types.
        </p>
      </div>

      <ResumeUploader />

      {resumes.length === 0 ? null : (
        <div className="grid gap-3">
          {resumes.map((r) => (
            <Link
              key={String(r._id)}
              href={`/resumes/${String(r._id)}`}
              className="group block transition-transform hover:-translate-y-0.5"
            >
              <Card className="flex items-center gap-4 p-4">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-[var(--color-bg-subtle)] text-[var(--color-fg-muted)]">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{r.name}</span>
                    {r.isActive && (
                      <Badge variant="accent" className="gap-1">
                        <Star className="h-3 w-3" /> Active
                      </Badge>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--color-fg-muted)]">
                    {r.parsed?.fullName ? `${r.parsed.fullName} · ` : ""}
                    {r.parsed?.inferredSeniority ?? "?"} · {r.parsed?.totalYearsExperience ?? 0}y
                    exp · uploaded {formatRelative((r as { createdAt?: Date }).createdAt ?? new Date())}
                  </div>
                </div>
                <span className="text-xs text-[var(--color-fg-subtle)] group-hover:text-[var(--color-fg-muted)]">
                  View →
                </span>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
