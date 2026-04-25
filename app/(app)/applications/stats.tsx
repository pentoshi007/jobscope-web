import { Card, CardContent } from "@/components/ui/card";

interface AppLike {
  status: string;
  appliedAt: Date | null;
  createdAt: Date;
}

export function Stats({ apps }: { apps: AppLike[] }) {
  const now = Date.now();
  const week = 7 * 86400 * 1000;
  const appliedThisWeek = apps.filter(
    (a) => a.appliedAt && now - new Date(a.appliedAt).getTime() < week,
  ).length;
  const total = apps.length;
  const interviews = apps.filter((a) => a.status === "interview" || a.status === "offer").length;
  const responseRate = total > 0 ? Math.round((interviews / total) * 100) : 0;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Stat label="Applied this week" value={appliedThisWeek} />
      <Stat label="Total in tracker" value={total} />
      <Stat label="Response rate" value={`${responseRate}%`} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="flex items-baseline justify-between p-5">
        <span className="text-sm text-[var(--color-fg-muted)]">{label}</span>
        <span className="font-mono text-2xl font-semibold tabular-nums">{value}</span>
      </CardContent>
    </Card>
  );
}
