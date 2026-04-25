"use client";
import { useState, useTransition } from "react";
import { Bookmark, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { saveJob, updateApplicationStatus, removeApplication } from "@/app/(app)/applications/actions";
import type { AppStatus } from "@/app/(app)/applications/actions";

const STATUSES: AppStatus[] = ["saved", "applied", "interview", "offer", "rejected"];

export function JobActions({
  jobId,
  currentStatus,
  matchScore,
}: {
  jobId: string;
  currentStatus: AppStatus | null;
  matchScore: number;
}) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<AppStatus | null>(currentStatus);

  function set(s: AppStatus) {
    startTransition(async () => {
      if (status) await updateApplicationStatus(jobId, s);
      else await saveJob(jobId, s, matchScore);
      setStatus(s);
      toast.success(`Marked as ${s}`);
    });
  }

  function remove() {
    startTransition(async () => {
      await removeApplication(jobId);
      setStatus(null);
      toast.success("Removed from tracker");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tracker</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {!status ? (
          <Button
            className="w-full"
            variant="accent"
            onClick={() => set("saved")}
            disabled={pending}
          >
            <Bookmark className="h-4 w-4" /> Save
          </Button>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-1.5">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={pending}
                  onClick={() => set(s)}
                  className={`rounded-md border px-2 py-1.5 text-xs capitalize transition-colors ${
                    status === s
                      ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                      : "border-[var(--color-border)] text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-subtle)]"
                  }`}
                >
                  {status === s && <Check className="mr-1 inline h-3 w-3" />}
                  {s}
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-[var(--color-fg-muted)]"
              onClick={remove}
              disabled={pending}
            >
              <X className="h-3 w-3" /> Remove from tracker
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
