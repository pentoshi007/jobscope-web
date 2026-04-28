import { Activity, AlertTriangle, Briefcase, FileText, Users } from "lucide-react";
import Link from "next/link";
import type React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getAdminSession, hasAdminPasswordConfigured } from "@/lib/admin";
import { connectMongoose, getDb } from "@/lib/db";
import { buildResumeJobProfile, familyLabels, jobMatchesProfile } from "@/lib/jobs/profile";
import { rankJobsForUser } from "@/lib/jobs/rank";
import { getSignedDownloadUrl } from "@/lib/r2";
import { formatRelative } from "@/lib/utils";
import { AppLog } from "@/models/app-log";
import { Job } from "@/models/job";
import { JobSourceHealth } from "@/models/job-source-health";
import { Resume } from "@/models/resume";
import { loginAdmin, logoutAdmin } from "./actions";
import { type AdminLogRow, LogsTable } from "./logs-table";

export const metadata = { title: "Admin" };

type UserRow = {
  id?: string;
  _id?: unknown;
  name?: string;
  email?: string;
  emailVerified?: boolean;
  createdAt?: Date;
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await getAdminSession();
  const sp = await searchParams;
  if (!admin) return <AdminLogin hasError={sp.error === "1"} />;

  await connectMongoose();
  const db = getDb();

  const [users, resumes, jobs, logs, sourceHealth] = await Promise.all([
    db
      .collection<UserRow>("user")
      .find({}, { projection: { id: 1, name: 1, email: 1, emailVerified: 1, createdAt: 1 } })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray(),
    Resume.find({ deletedAt: null })
      .sort({ createdAt: -1 })
      .select({ userId: 1, name: 1, fileKey: 1, fileName: 1, isActive: 1, parsed: 1, createdAt: 1 })
      .lean(),
    Job.find({
      $or: [
        { cacheExpiresAt: { $gte: new Date() } },
        { fetchedAt: { $gte: new Date(Date.now() - 48 * 60 * 60 * 1000) } },
      ],
    })
      .sort({ postedAt: -1 })
      .limit(300)
      .select({
        title: 1,
        company: 1,
        location: 1,
        remote: 1,
        seniority: 1,
        source: 1,
        postedAt: 1,
        description: 1,
        category: 1,
        tags: 1,
        extractedSkills: 1,
      })
      .lean(),
    AppLog.find({})
      .sort({ seen: 1, lastSeenAt: -1 })
      .limit(100)
      .select({
        level: 1,
        kind: 1,
        source: 1,
        message: 1,
        path: 1,
        status: 1,
        count: 1,
        seen: 1,
        firstSeenAt: 1,
        lastSeenAt: 1,
        stack: 1,
        meta: 1,
      })
      .lean(),
    JobSourceHealth.find({})
      .sort({ failed: -1, lastRunAt: -1 })
      .limit(30)
      .select({
        source: 1,
        enabled: 1,
        fetched: 1,
        normalized: 1,
        upserted: 1,
        skipped: 1,
        failed: 1,
        durationMs: 1,
        lastSuccessAt: 1,
        lastErrorAt: 1,
        lastError: 1,
        lastRunAt: 1,
      })
      .lean(),
  ]);

  const resumeByUser = new Map<string, typeof resumes>();
  for (const resume of resumes) {
    const userResumes = resumeByUser.get(resume.userId) ?? [];
    userResumes.push(resume);
    resumeByUser.set(resume.userId, userResumes);
  }

  const signedResumeUrls = new Map<string, string>();
  await Promise.all(
    resumes.slice(0, 80).map(async (resume) => {
      try {
        signedResumeUrls.set(String(resume._id), await getSignedDownloadUrl(resume.fileKey));
      } catch {
        signedResumeUrls.set(String(resume._id), "");
      }
    }),
  );

  const userCards = users.map((user) => {
    const userId = String(user.id ?? user._id ?? "");
    const userResumes = resumeByUser.get(userId) ?? [];
    const active = userResumes.find((resume) => resume.isActive) ?? userResumes[0];
    const profile = active ? buildResumeJobProfile([active.parsed as never]) : null;
    const suggestions = active
      ? rankJobsForUser<(typeof jobs)[number]>(
          [active.parsed as never],
          jobs.filter((job) => !profile || jobMatchesProfile(profile, job)),
          { roleProfile: profile ?? undefined, minScore: 30, limit: 3 },
        ).map(({ j, m }) => ({ job: j, match: m }))
      : [];
    return { user, userId, resumes: userResumes.slice(0, 3), active, profile, suggestions };
  });

  const professionCounts = topProfessionCounts(resumes);
  const totalUsers = users.length;
  const verified = users.filter((u) => u.emailVerified).length;
  const activeResumeUsers = new Set(resumes.filter((r) => r.isActive).map((r) => r.userId)).size;
  const unseenLogs = logs.filter((log) => !log.seen).length;

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
          <p className="text-sm text-[var(--color-fg-muted)]">
            Users, resume signals, cached matches, and deduped app events.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Last 48h jobs: {jobs.length}</Badge>
          <form action={logoutAdmin}>
            <Button type="submit" variant="outline" size="sm">
              Log out
            </Button>
          </form>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Users} label="Signed up users" value={totalUsers} />
        <Metric icon={FileText} label="Users with active resumes" value={activeResumeUsers} />
        <Metric icon={Briefcase} label="Cached jobs" value={jobs.length} />
        <Metric icon={AlertTriangle} label="Unseen logs" value={unseenLogs} />
      </div>

      <Card className="p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-[var(--color-accent)]" />
          <h2 className="font-semibold tracking-tight">Job source health</h2>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {sourceHealth.map((source) => (
            <div
              key={source.source}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-mono text-sm">{source.source}</div>
                <Badge variant={!source.enabled ? "outline" : source.failed ? "danger" : "success"}>
                  {!source.enabled ? "disabled" : source.failed ? "issue" : "healthy"}
                </Badge>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <SourceStat label="fetched" value={source.fetched} />
                <SourceStat label="upserted" value={source.upserted} />
                <SourceStat label="ms" value={source.durationMs} />
              </div>
              {source.lastError && (
                <p className="mt-2 line-clamp-2 text-xs text-[var(--color-danger)]">
                  {source.lastError}
                </p>
              )}
              <p className="mt-2 text-xs text-[var(--color-fg-subtle)]">
                Last run {formatRelative(source.lastRunAt ?? new Date())}
              </p>
            </div>
          ))}
          {sourceHealth.length === 0 && (
            <p className="text-sm text-[var(--color-fg-muted)]">
              Source health will appear after the next job fetch.
            </p>
          )}
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-[var(--color-accent)]" />
            <h2 className="font-semibold tracking-tight">Users and suggested jobs</h2>
          </div>
          <div className="grid gap-3">
            {userCards.map(
              ({ user, userId, resumes: userResumes, active, profile, suggestions }) => (
                <div
                  key={userId}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{user.name || "Unnamed user"}</div>
                      <div className="truncate text-sm text-[var(--color-fg-muted)]">
                        {user.email}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant={user.emailVerified ? "success" : "warning"}>
                        {user.emailVerified ? "verified" : "unverified"}
                      </Badge>
                      <Badge variant="outline">{userResumes.length} resumes</Badge>
                    </div>
                  </div>

                  {active && (
                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      <div>
                        <div className="text-xs font-medium uppercase text-[var(--color-fg-subtle)]">
                          Resume fields
                        </div>
                        <div className="mt-1 text-sm">
                          <div className="font-medium">
                            {active.parsed?.fullName || active.name}
                          </div>
                          <div className="text-[var(--color-fg-muted)]">
                            {active.parsed?.headline || "No headline parsed yet"}
                          </div>
                          {profile && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {familyLabels(profile).map((family) => (
                                <Badge key={family} variant="accent">
                                  {family}
                                </Badge>
                              ))}
                            </div>
                          )}
                          <div className="mt-1 flex flex-wrap gap-1">
                            {resumeSkills(active.parsed as never)
                              .slice(0, 8)
                              .map((skill) => (
                                <Badge key={skill} variant="mono">
                                  {skill}
                                </Badge>
                              ))}
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          {userResumes.map((resume) => {
                            const url = signedResumeUrls.get(String(resume._id));
                            return url ? (
                              <a
                                key={String(resume._id)}
                                href={url}
                                className="text-[var(--color-accent)] hover:underline"
                                target="_blank"
                                rel="noreferrer"
                              >
                                {resume.fileName || resume.name}
                              </a>
                            ) : (
                              <span key={String(resume._id)}>{resume.fileName || resume.name}</span>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-medium uppercase text-[var(--color-fg-subtle)]">
                          Suggested jobs
                        </div>
                        <div className="mt-1 space-y-2">
                          {suggestions.map(({ job, match }) => (
                            <Link
                              href={`/jobs/${String(job._id)}`}
                              key={String(job._id)}
                              className="block rounded-md border border-[var(--color-border)] p-2 hover:bg-[var(--color-bg-subtle)]"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate text-sm font-medium">{job.title}</span>
                                <span className="font-mono text-xs">{match.score}</span>
                              </div>
                              <div className="truncate text-xs text-[var(--color-fg-muted)]">
                                {job.company} · {job.source} · {formatRelative(job.postedAt)}
                              </div>
                            </Link>
                          ))}
                          {suggestions.length === 0 && (
                            <p className="text-sm text-[var(--color-fg-muted)]">
                              No cached suggestions.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ),
            )}
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-[var(--color-accent)]" />
            <h2 className="font-semibold tracking-tight">Platform data</h2>
          </div>
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-[var(--color-fg-muted)]">Email verified</span>
                <span className="font-mono">
                  {verified}/{totalUsers}
                </span>
              </div>
              <Bar value={totalUsers ? (verified / totalUsers) * 100 : 0} />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Top professions</div>
              {professionCounts.map(({ label, count }) => (
                <div key={label}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="truncate capitalize">{label}</span>
                    <span className="font-mono">{count}</span>
                  </div>
                  <Bar value={(count / Math.max(1, professionCounts[0]?.count ?? 1)) * 100} />
                </div>
              ))}
              {professionCounts.length === 0 && (
                <p className="text-sm text-[var(--color-fg-muted)]">No parsed professions yet.</p>
              )}
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-[var(--color-accent)]" />
          <h2 className="font-semibold tracking-tight">Logs</h2>
        </div>
        <LogsTable logs={logs.map(toLogRow)} />
      </Card>
    </div>
  );
}

function AdminLogin({ hasError }: { hasError: boolean }) {
  const configured = hasAdminPasswordConfigured();
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--color-bg-subtle)] px-4 py-10">
      <Card className="w-full max-w-sm p-5">
        <div className="mb-5">
          <h1 className="text-xl font-semibold tracking-tight">Admin login</h1>
          <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
            Enter the admin email and password configured in environment variables.
          </p>
        </div>
        {!configured && (
          <div className="mb-4 rounded-md border border-[var(--color-warning)] bg-[var(--color-warning-soft)] p-3 text-sm">
            Set ADMIN_EMAILS and ADMIN_PASSWORD before using this page.
          </div>
        )}
        {hasError && (
          <div className="mb-4 rounded-md border border-[var(--color-danger)] bg-[var(--color-danger-soft)] p-3 text-sm">
            Invalid admin email or password.
          </div>
        )}
        <form action={loginAdmin} className="space-y-3">
          <Input name="email" type="email" placeholder="admin@example.com" required />
          <Input name="password" type="password" placeholder="Admin password" required />
          <Button type="submit" variant="accent" className="w-full" disabled={!configured}>
            Continue
          </Button>
        </form>
      </Card>
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
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

function Bar({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
      <div
        className="h-full rounded-full bg-[var(--color-accent)]"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

function SourceStat({ label, value }: { label: string; value?: number | null }) {
  return (
    <div>
      <div className="font-mono text-sm">{value ?? 0}</div>
      <div className="text-[10px] uppercase text-[var(--color-fg-subtle)]">{label}</div>
    </div>
  );
}

function resumeSkills(parsed: {
  skills?: {
    languages?: string[] | null;
    frameworks?: string[] | null;
    tools?: string[] | null;
    databases?: string[] | null;
    cloud?: string[] | null;
  } | null;
}) {
  return [
    ...(parsed?.skills?.languages ?? []),
    ...(parsed?.skills?.frameworks ?? []),
    ...(parsed?.skills?.tools ?? []),
    ...(parsed?.skills?.databases ?? []),
    ...(parsed?.skills?.cloud ?? []),
  ];
}

function topProfessionCounts(
  resumes: Array<{
    parsed?: {
      headline?: string | null;
      jobSearchProfile?: { primaryRole?: string | null } | null;
      experience?: Array<{ role?: string | null }> | null;
    } | null;
  }>,
) {
  const counts = new Map<string, number>();
  for (const resume of resumes) {
    const raw =
      resume.parsed?.jobSearchProfile?.primaryRole ||
      resume.parsed?.headline ||
      resume.parsed?.experience?.[0]?.role ||
      "unknown";
    const label = normalizeProfession(raw);
    if (!label || label === "unknown") continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

function normalizeProfession(raw: string) {
  const value = raw.toLowerCase();
  if (/cyber|security|soc|incident|vulnerability/.test(value)) return "cybersecurity";
  if (/front[-\s]?end|react|vue|angular/.test(value)) return "frontend developer";
  if (/back[-\s]?end|node|java|python|api/.test(value)) return "backend developer";
  if (/full[-\s]?stack/.test(value)) return "full stack developer";
  if (/finance|financial|accounting|audit/.test(value)) return "finance";
  if (/video|editor|motion|premiere|after effects/.test(value)) return "video editing";
  if (/data|analytics|analyst/.test(value)) return "data";
  if (/machine learning|ml|ai/.test(value)) return "machine learning";
  if (/devops|sre|cloud|platform/.test(value)) return "devops";
  if (/design|ui|ux/.test(value)) return "design";
  return (
    raw
      .split(/[|,(-]/)[0]
      ?.trim()
      .toLowerCase() || "unknown"
  );
}

function toLogRow(log: {
  _id: unknown;
  level?: string;
  kind?: string;
  source?: string;
  message?: string;
  path?: string;
  status?: number | null;
  count?: number;
  seen?: boolean;
  firstSeenAt?: Date;
  lastSeenAt?: Date;
  stack?: string;
  meta?: unknown;
}): AdminLogRow {
  return {
    id: String(log._id),
    level: log.level ?? "error",
    kind: log.kind ?? "error",
    source: log.source ?? "",
    message: log.message ?? "",
    path: log.path ?? "",
    status: log.status ?? null,
    count: log.count ?? 1,
    seen: !!log.seen,
    firstSeenAt: (log.firstSeenAt ?? new Date()).toISOString(),
    lastSeenAt: (log.lastSeenAt ?? new Date()).toISOString(),
    stack: log.stack ?? "",
    meta: (log.meta as Record<string, unknown> | undefined) ?? {},
  };
}
