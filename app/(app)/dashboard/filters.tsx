"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import { useState, useEffect, useTransition, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function DashboardFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [isPending, startTransition] = useTransition();

  const navigate = useCallback(
    (params: URLSearchParams) => {
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`);
      });
    },
    [router, pathname],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams(sp);
      if (q) params.set("q", q);
      else params.delete("q");
      navigate(params);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function toggle(key: string, value: string) {
    const params = new URLSearchParams(sp);
    if (params.get(key) === value) params.delete(key);
    else params.set(key, value);
    navigate(params);
  }

  const remote = sp.get("remote") === "1";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--color-fg-subtle)]" />
        <Input
          placeholder="Search title, company..."
          className="h-9 w-64 pl-8"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <Button
        size="sm"
        variant={remote ? "accent" : "outline"}
        onClick={() => toggle("remote", "1")}
        className="relative"
      >
        Remote only
      </Button>
      <SeniorityFilter value={sp.get("seniority")} onToggle={(v) => toggle("seniority", v)} />
      {isPending && (
        <Loader2 className="h-4 w-4 animate-spin text-[var(--color-fg-muted)]" />
      )}
    </div>
  );
}

function SeniorityFilter({
  value,
  onToggle,
}: {
  value: string | null;
  onToggle: (v: string) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-md border border-[var(--color-border)]">
      {["junior", "mid", "senior", "staff"].map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onToggle(s)}
          className={`px-2.5 py-1 text-xs capitalize transition-colors ${
            value === s
              ? "bg-[var(--color-fg)] text-[var(--color-bg)]"
              : "text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-subtle)]"
          }`}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
