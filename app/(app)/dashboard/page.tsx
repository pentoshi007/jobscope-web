import { ArrowRight, BriefcaseBusiness, FileText, Sparkles, Target } from "lucide-react";
import Link from "next/link";
import type React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { connectMongoose } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { formatRelative } from "@/lib/utils";
import { Resume } from "@/models/resume";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await requireSession();
  await connectMongoose();
  const resumes = await Resume.find({
    userId: session.user.id,
    deletedAt: null,
  })
    .sort({ isActive: -1, updatedAt: -1 })
    .limit(6)
    .lean();

  const activeResumes = resumes.filter((resume) => resume.isActive);

  if (resumes.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <Card>
          <CardContent className="space-y-5 py-10 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-md bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Upload a resume to begin</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-[var(--color-fg-muted)]">
                JobScope parses the resume first. Review the fields, save, then open ranked jobs.
              </p>
            </div>
            <Button variant="accent" asChild>
              <Link href="/resumes">
                Upload resume <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-[var(--color-fg-muted)]">
            {activeResumes.length} active resume{activeResumes.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/resumes">
              <FileText className="h-4 w-4" />
              Resumes
            </Link>
          </Button>
          <Button variant="accent" asChild>
            <Link href="/jobs">
              <BriefcaseBusiness className="h-4 w-4" />
              View jobs
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <OverviewMetric label="Active resumes" value={activeResumes.length} icon={Target} />
        <OverviewMetric label="Total resumes" value={resumes.length} icon={FileText} />
        <OverviewMetric
          label="Ready profiles"
          value={resumes.filter((resume) => resume.parsed?.jobSearchProfile?.primaryRole).length}
          icon={Sparkles}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resume profiles</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {resumes.map((resume) => {
            const profile = resume.parsed?.jobSearchProfile;
            return (
              <Link
                href={`/resumes/${String(resume._id)}`}
                key={String(resume._id)}
                className="block rounded-md border border-[var(--color-border)] p-3 transition-colors hover:bg-[var(--color-bg-subtle)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{resume.name}</span>
                      {resume.isActive && <Badge variant="accent">Active</Badge>}
                      {profile?.source === "ai" && <Badge variant="success">AI profile</Badge>}
                    </div>
                    <div className="mt-1 text-sm text-[var(--color-fg-muted)]">
                      {profile?.primaryRole || resume.parsed?.headline || "Review extracted fields"}
                    </div>
                    {profile?.targetTitles?.length ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {profile.targetTitles.slice(0, 4).map((title) => (
                          <Badge key={title} variant="outline" className="text-[10px]">
                            {title}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs text-[var(--color-fg-subtle)]">
                    {formatRelative(
                      (resume as { updatedAt?: Date; createdAt?: Date }).updatedAt ??
                        (resume as { createdAt?: Date }).createdAt ??
                        new Date(),
                    )}
                  </span>
                </div>
              </Link>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function OverviewMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm text-[var(--color-fg-muted)]">{label}</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-md bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}
