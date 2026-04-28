import { ArrowRight, BriefcaseBusiness } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { connectMongoose } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Resume } from "@/models/resume";
import { DashboardFilters } from "../dashboard/filters";
import { StreamingFeed } from "../dashboard/streaming-feed";

export const metadata = { title: "Jobs" };

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const sp = await searchParams;
  await connectMongoose();
  const activeResumes = await Resume.find({
    userId: session.user.id,
    isActive: true,
    deletedAt: null,
  })
    .sort({ createdAt: -1 })
    .lean();

  if (activeResumes.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <Card>
          <CardContent className="space-y-5 py-10 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-md bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
              <BriefcaseBusiness className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Upload a resume to begin</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-[var(--color-fg-muted)]">
                Review the extracted fields, save the resume, then JobScope will fetch matches for
                that profile.
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

  const resumeNames = activeResumes.map((r) => r.name).join(", ");
  void sp;

  return (
    <div className="space-y-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
          <p className="text-sm text-[var(--color-fg-muted)]">
            Ranked against{" "}
            <span className="font-medium text-[var(--color-fg)]">
              {activeResumes.length === 1 ? resumeNames : `${activeResumes.length} active resumes`}
            </span>
          </p>
        </div>
        <DashboardFilters />
      </div>
      <StreamingFeed />
    </div>
  );
}
