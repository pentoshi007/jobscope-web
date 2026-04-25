import Link from "next/link";
import { ArrowRight, Sparkles, Search, Layers, Brain, Mail, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(60% 40% at 50% 0%, color-mix(in oklch, var(--color-accent) 14%, transparent), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(var(--color-fg) 1px, transparent 1px), linear-gradient(90deg, var(--color-fg) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-[var(--color-fg)] text-[var(--color-bg)]">
            <Sparkles className="h-4 w-4" />
          </span>
          JobScope
        </Link>
        <nav className="flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/pricing">Pricing</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button size="sm" variant="accent" asChild>
            <Link href="/signup">Get started</Link>
          </Button>
          <ThemeToggle />
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-20 pt-12 sm:pt-20">
        <section className="text-center">
          <Badge variant="accent" className="mb-6">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
            10,000+ live jobs · always free
          </Badge>
          <h1 className="mx-auto max-w-3xl text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            Job search,{" "}
            <span className="bg-gradient-to-r from-[var(--color-accent)] to-[oklch(0.75_0.18_300)] bg-clip-text text-transparent">
              scoped to your resume.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-balance text-lg leading-relaxed text-[var(--color-fg-muted)]">
            Upload a resume. JobScope parses it, fans out to free public job APIs, and ranks the
            best matches with a transparent score.
          </p>
          <div className="mt-9 flex items-center justify-center gap-3">
            <Button size="lg" variant="accent" asChild>
              <Link href="/signup">
                Start free <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">I have an account</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-[var(--color-fg-subtle)]">
            No credit card. Email or Google. Your data stays yours.
          </p>
        </section>

        <section className="mt-24 grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-border)] sm:grid-cols-3">
          <Feature
            icon={<Search className="h-5 w-5" />}
            title="Aggregated, not scraped"
            body="Remotive, Arbeitnow, Adzuna, Jooble, The Muse, JSearch, USAJobs — all via licensed free APIs."
          />
          <Feature
            icon={<Brain className="h-5 w-5" />}
            title="Resume-aware scoring"
            body="Each job ranked 0–100 with a breakdown: skills, seniority, location, experience, recency."
          />
          <Feature
            icon={<Layers className="h-5 w-5" />}
            title="Tracker built-in"
            body="Drag from Saved → Applied → Interview → Offer. Reminders nudge you on time."
          />
        </section>

        <section className="mt-24 grid items-center gap-10 sm:grid-cols-2">
          <div>
            <Badge variant="outline">How it works</Badge>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Upload once. Get matches every morning.
            </h2>
            <ol className="mt-6 space-y-4 text-[var(--color-fg-muted)]">
              {[
                ["01", "Drop in a PDF or DOCX resume. We parse skills, experience, seniority."],
                ["02", "A daily cron pulls fresh jobs from 7+ sources, dedupes, enriches with skills."],
                ["03", "Your dashboard shows ranked matches with green-pill matched skills."],
                ["04", "AI helpers draft cover letters, gap analyses, interview prep on demand."],
              ].map(([n, t]) => (
                <li key={n} className="flex gap-4">
                  <span className="font-mono text-xs text-[var(--color-fg-subtle)]">{n}</span>
                  <span className="text-[var(--color-fg)]">{t}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-[var(--shadow-soft)]">
            <div className="absolute inset-x-6 top-6 flex items-center justify-between text-xs text-[var(--color-fg-subtle)]">
              <span className="font-mono">dashboard.jobscope</span>
              <span className="font-mono">match ≥ 80</span>
            </div>
            <div className="mt-10 space-y-3">
              {[
                { t: "Senior Backend Engineer", c: "Linear", s: 94, m: ["Go", "Postgres", "gRPC"] },
                { t: "Platform Engineer", c: "Vercel", s: 88, m: ["TypeScript", "AWS", "K8s"] },
                { t: "Full-Stack Developer", c: "Notion", s: 82, m: ["React", "Node"] },
              ].map((j) => (
                <div
                  key={j.t}
                  className="flex items-center justify-between rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3"
                >
                  <div>
                    <div className="text-sm font-medium">{j.t}</div>
                    <div className="text-xs text-[var(--color-fg-muted)]">{j.c}</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {j.m.map((s) => (
                        <Badge key={s} variant="success" className="font-mono text-[10px]">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="font-mono text-2xl font-semibold tabular-nums text-[var(--color-accent)]">
                    {j.s}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--color-border)]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 text-xs text-[var(--color-fg-muted)] sm:flex-row">
          <span>© {new Date().getFullYear()} JobScope · always free</span>
          <div className="flex items-center gap-3">
            <Link href="/pricing" className="hover:text-[var(--color-fg)]">
              Pricing
            </Link>
            <a className="flex items-center gap-1 hover:text-[var(--color-fg)]" href="mailto:hi@jobscope.app">
              <Mail className="h-3 w-3" /> Contact
            </a>
            <a
              className="flex items-center gap-1 hover:text-[var(--color-fg)]"
              href="https://github.com"
            >
              <Code2 className="h-3 w-3" /> GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="bg-[var(--color-bg)] p-7">
      <div className="mb-3 inline-grid h-9 w-9 place-items-center rounded-md bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
        {icon}
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-[var(--color-fg-muted)]">{body}</p>
    </div>
  );
}
