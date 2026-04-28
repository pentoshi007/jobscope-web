"use client";

import { Check, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteAllLogs, deleteLogs, markLogsSeen } from "./actions";

export interface AdminLogRow {
  id: string;
  level: string;
  kind: string;
  source: string;
  message: string;
  path: string;
  status: number | null;
  count: number;
  seen: boolean;
  lastSeenAt: string;
}

export function LogsTable({ logs }: { logs: AdminLogRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const selectedIds = useMemo(() => [...selected], [selected]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function run(action: "seen" | "delete" | "deleteAll") {
    startTransition(async () => {
      if (action === "seen") await markLogsSeen(selectedIds);
      if (action === "delete") await deleteLogs(selectedIds);
      if (action === "deleteAll") await deleteAllLogs();
      setSelected(new Set());
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-[var(--color-fg-muted)]">
          {logs.length} deduped event{logs.length === 1 ? "" : "s"}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={selectedIds.length === 0 || isPending}
            onClick={() => run("seen")}
          >
            <Check className="h-4 w-4" />
            Seen
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={selectedIds.length === 0 || isPending}
            onClick={() => run("delete")}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={logs.length === 0 || isPending}
            onClick={() => run("deleteAll")}
          >
            Delete all
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--color-border)]">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="bg-[var(--color-bg-subtle)] text-xs uppercase text-[var(--color-fg-subtle)]">
            <tr>
              <th className="w-10 px-3 py-2">
                <span className="sr-only">Select</span>
              </th>
              <th className="px-3 py-2">Event</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Count</th>
              <th className="px-3 py-2">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-[var(--color-border)] align-top">
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--color-accent)]"
                    checked={selected.has(log.id)}
                    onChange={() => toggle(log.id)}
                    aria-label={`Select ${log.source || log.kind}`}
                  />
                </td>
                <td className="max-w-[360px] px-3 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge
                      variant={
                        log.kind === "rate_limit"
                          ? "warning"
                          : log.level === "error"
                            ? "danger"
                            : "outline"
                      }
                    >
                      {log.kind}
                    </Badge>
                    {!log.seen && <Badge variant="accent">new</Badge>}
                  </div>
                  <p className="mt-1 line-clamp-2 text-[var(--color-fg)]">{log.message}</p>
                  {log.path && (
                    <p className="mt-1 font-mono text-xs text-[var(--color-fg-subtle)]">
                      {log.path}
                    </p>
                  )}
                </td>
                <td className="px-3 py-3 font-mono text-xs text-[var(--color-fg-muted)]">
                  {log.source || "-"}
                </td>
                <td className="px-3 py-3 font-mono text-xs">{log.status ?? "-"}</td>
                <td className="px-3 py-3 font-mono text-xs">{log.count}</td>
                <td className="px-3 py-3 text-xs text-[var(--color-fg-muted)]">
                  {new Date(log.lastSeenAt).toLocaleString()}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-8 text-center text-sm text-[var(--color-fg-muted)]"
                >
                  No app errors or rate limits have been logged.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
