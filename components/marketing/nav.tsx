"use client";
import { Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

const LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#how", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
];

export function MarketingNav() {
  const [open, setOpen] = useState(false);

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
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--color-border)]/60 bg-[var(--color-bg)]/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" aria-label="JobScope home" onClick={() => setOpen(false)}>
            <Logo />
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {LINKS.map((l) => (
              <Button key={l.href} variant="ghost" size="sm" asChild>
                <Link href={l.href}>{l.label}</Link>
              </Button>
            ))}
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button size="sm" variant="accent" asChild>
              <Link href="/signup">Get started</Link>
            </Button>
            <ThemeToggle />
          </nav>

          <div className="flex items-center gap-1 md:hidden">
            <ThemeToggle />
            <button
              type="button"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="grid h-9 w-9 place-items-center rounded-md border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-fg)] transition-colors hover:bg-[var(--color-bg-subtle)]"
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {open && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                onClick={() => setOpen(false)}
                className="fixed inset-x-0 bottom-0 top-[57px] z-30 bg-[var(--color-bg)]/40 backdrop-blur-sm md:hidden"
              />
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-x-0 top-full z-40 border-b border-[var(--color-border)] bg-[var(--color-bg)] md:hidden"
              >
                <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4">
                  {LINKS.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className="rounded-md px-3 py-2.5 text-sm font-medium text-[var(--color-fg)] transition-colors hover:bg-[var(--color-bg-subtle)]"
                    >
                      {l.label}
                    </Link>
                  ))}
                  <div className="mt-2 grid grid-cols-2 gap-2 border-t border-[var(--color-border)] pt-3">
                    <Button variant="outline" asChild onClick={() => setOpen(false)}>
                      <Link href="/login">Sign in</Link>
                    </Button>
                    <Button variant="accent" asChild onClick={() => setOpen(false)}>
                      <Link href="/signup">Get started</Link>
                    </Button>
                  </div>
                </nav>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </header>
      <div aria-hidden className="h-[57px]" />
    </>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-bg-subtle)]/35">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row sm:items-end">
          <div className="space-y-1 text-center sm:text-left">
            <Logo size={20} />
            <p className="text-xs text-[var(--color-fg-muted)]">
              Resume-aware job search, built for focus.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-[var(--color-fg-muted)] sm:justify-end">
            <Link href="/pricing" className="hover:text-[var(--color-fg)]">
              Pricing
            </Link>
            <Link href="/login" className="hover:text-[var(--color-fg)]">
              Sign in
            </Link>
            <Link href="/signup" className="hover:text-[var(--color-fg)]">
              Get started
            </Link>
            <a href="mailto:hi@jobscope.app" className="hover:text-[var(--color-fg)]">
              Contact
            </a>
          </div>
        </div>
        <div className="mt-5 border-t border-[var(--color-border)] pt-4 text-center text-[11px] text-[var(--color-fg-subtle)] sm:text-left">
          Designed to help you apply better, not scroll longer.
        </div>
      </div>
    </footer>
  );
}
