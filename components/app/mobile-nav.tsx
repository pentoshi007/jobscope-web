"use client";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV } from "@/components/app/sidebar";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    void pathname;
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-fg)] shadow-sm hover:bg-[var(--color-bg-subtle)] md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[88vw] flex-col border-r border-[var(--color-border)] bg-[var(--color-card)] shadow-xl">
            <div className="flex h-14 items-center justify-between px-5">
              <Link href="/dashboard" onClick={() => setOpen(false)}>
                <Logo size={24} />
              </Link>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--color-fg-muted)] hover:bg-[var(--color-card)] hover:text-[var(--color-fg)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-0.5 px-3 py-2">
              {NAV.map((n) => {
                const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
                const Icon = n.icon;
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-2.5 text-sm transition-colors",
                      active
                        ? "bg-[var(--color-card)] font-medium text-[var(--color-fg)] shadow-sm"
                        : "text-[var(--color-fg-muted)] hover:bg-[var(--color-card)] hover:text-[var(--color-fg)]",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {n.label}
                  </Link>
                );
              })}
            </nav>
            <div className="px-3 py-3 text-[11px] text-[var(--color-fg-subtle)]">
              Always free · 0₹/month
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
