import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div className="space-y-4">
        <p className="font-mono text-xs uppercase tracking-wider text-[var(--color-fg-subtle)]">
          404
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
        <p className="text-[var(--color-fg-muted)]">
          The page you're looking for doesn't exist or moved.
        </p>
        <Button variant="accent" asChild>
          <Link href="/">Back home</Link>
        </Button>
      </div>
    </div>
  );
}
