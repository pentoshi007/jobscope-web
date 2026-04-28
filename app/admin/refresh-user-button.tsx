"use client";

import { CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Phase = "idle" | "running" | "done" | "error";

export function AdminRefreshUserButton({
  userId,
  disabled,
}: {
  userId: string;
  disabled?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [messages, setMessages] = useState<string[]>([]);
  const [summary, setSummary] = useState("");

  async function run() {
    setPhase("running");
    setMessages([]);
    setSummary("");

    try {
      const res = await fetch("/api/jobs/trigger-user-refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
        credentials: "include",
      });

      if (!res.ok || !res.body) {
        setPhase("error");
        setSummary(`HTTP ${res.status}`);
        return;
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";

        for (const part of parts) {
          const eventMatch = part.match(/^event:\s*(.+)$/m);
          const dataMatch = part.match(/^data:\s*(.+)$/m);
          if (!dataMatch) continue;
          try {
            const data = JSON.parse(dataMatch[1]) as {
              phase?: string;
              msg?: string;
              ok?: boolean;
              error?: string;
              apify?: { fetched?: number; upserted?: number; error?: string };
              email?: { status?: string; count?: number; reason?: string };
            };
            if (data.msg) setMessages((prev) => [...prev, data.msg!]);
            if (eventMatch?.[1] === "done") {
              if (data.ok) {
                const apifyPart = data.apify?.error
                  ? "LinkedIn error"
                  : `LinkedIn ${data.apify?.fetched ?? 0} fetched`;
                const emailPart =
                  data.email?.status === "sent"
                    ? `email sent (${data.email.count})`
                    : `email skipped`;
                setSummary(`${apifyPart} · ${emailPart}`);
                setPhase("done");
              } else {
                setSummary(data.error ?? "Failed");
                setPhase("error");
              }
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (e) {
      setPhase("error");
      setSummary(e instanceof Error ? e.message : "Request failed");
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || phase === "running"}
          onClick={run}
        >
          {phase === "running" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : phase === "done" ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-success)]" />
          ) : phase === "error" ? (
            <XCircle className="h-3.5 w-3.5 text-[var(--color-danger)]" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {phase === "running" ? "Running…" : "Refresh jobs"}
        </Button>
        {phase === "running" && (
          <Badge variant="warning">
            <span className="relative mr-1.5 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-warning)] opacity-75" />
              <span className="inline-flex h-2 w-2 rounded-full bg-[var(--color-warning)]" />
            </span>
            In progress
          </Badge>
        )}
        {phase === "done" && <Badge variant="success">✓ {summary}</Badge>}
        {phase === "error" && <Badge variant="danger">✗ {summary}</Badge>}
      </div>

      {messages.length > 0 && phase === "running" && (
        <div className="max-h-28 overflow-y-auto rounded-md border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-2">
          <div className="space-y-0.5 font-mono text-[11px] text-[var(--color-fg-muted)]">
            {messages.map((msg, i) => (
              <div key={i} className="flex gap-1.5">
                <span className="select-none text-[var(--color-fg-subtle)]">›</span>
                <span>{msg}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5 text-[var(--color-accent)]">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              <span>Working…</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
