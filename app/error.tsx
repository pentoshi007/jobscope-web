"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    void fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        digest: error.digest,
        stack: error.stack,
        path: window.location.pathname,
      }),
    }).catch(() => {});
  }, [error]);
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div className="space-y-4">
        <p className="font-mono text-xs uppercase tracking-wider text-[var(--color-danger)]">
          Something broke
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">An unexpected error occurred</h1>
        {error.digest && (
          <p className="font-mono text-xs text-[var(--color-fg-subtle)]">{error.digest}</p>
        )}
        <Button variant="accent" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
