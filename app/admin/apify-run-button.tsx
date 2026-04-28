"use client";

import { Loader2, Play, CheckCircle2, XCircle } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Phase = "idle" | "running" | "success" | "error";

interface SseEvent {
  phase?: string;
  message?: string;
  ok?: boolean;
  fetched?: number;
  upserted?: number;
  durationMs?: number;
  error?: string;
}

export function ApifyRunButton() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [messages, setMessages] = useState<string[]>([]);
  const [result, setResult] = useState<SseEvent | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async () => {
    setPhase("running");
    setMessages([]);
    setResult(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/admin/apify-run", {
        method: "POST",
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        setPhase("error");
        setResult({ ok: false, error: `HTTP ${res.status}` });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE frames
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const eventLine = part.match(/^event:\s*(.+)$/m);
          const dataLine = part.match(/^data:\s*(.+)$/m);
          if (!dataLine) continue;

          try {
            const data = JSON.parse(dataLine[1]) as SseEvent;
            if (data.message) {
              setMessages((prev) => [...prev, data.message!]);
            }
            if (eventLine?.[1] === "done") {
              setPhase(data.ok ? "success" : "error");
              setResult(data);
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setPhase("error");
      setResult({ ok: false, error: (e as Error).message });
    }
  }, []);

  const reset = () => {
    setPhase("idle");
    setMessages([]);
    setResult(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="accent"
          size="sm"
          disabled={phase === "running"}
          onClick={phase === "idle" ? run : reset}
        >
          {phase === "running" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Running Apify…
            </>
          ) : phase === "success" ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Run again
            </>
          ) : phase === "error" ? (
            <>
              <XCircle className="h-4 w-4" />
              Retry
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Run Apify
            </>
          )}
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
        {phase === "success" && (
          <Badge variant="success">
            ✓ {result?.fetched ?? 0} fetched, {result?.upserted ?? 0} upserted
          </Badge>
        )}
        {phase === "error" && (
          <Badge variant="danger">✗ {result?.error ?? "Failed"}</Badge>
        )}
      </div>

      {messages.length > 0 && (
        <div className="max-h-40 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-3">
          <div className="space-y-1 font-mono text-xs text-[var(--color-fg-muted)]">
            {messages.map((msg, i) => (
              <div key={i} className="flex gap-2">
                <span className="select-none text-[var(--color-fg-subtle)]">›</span>
                <span>{msg}</span>
              </div>
            ))}
            {phase === "running" && (
              <div className="flex items-center gap-2 text-[var(--color-accent)]">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Waiting for next update…</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
