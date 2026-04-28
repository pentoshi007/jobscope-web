"use client";

import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
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
    <html lang="en">
      <body>
        <main className="grid min-h-dvh place-items-center px-6 text-center">
          <div className="space-y-3">
            <p className="font-mono text-xs uppercase tracking-wider">Something broke</p>
            <h1 className="text-2xl font-semibold tracking-tight">An unexpected error occurred</h1>
            {error.digest && <p className="font-mono text-xs">{error.digest}</p>}
          </div>
        </main>
      </body>
    </html>
  );
}
