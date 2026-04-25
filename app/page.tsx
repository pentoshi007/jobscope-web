import Link from "next/link";
import {
  ArrowRight,
  Sparkles,
  Brain,
  Layers,
  Zap,
  ShieldCheck,
  Mail,
  FileText,
  Search,
  Bookmark,
  Send,
  Trophy,
  X,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MarketingNav, MarketingFooter } from "@/components/marketing/nav";
import { Reveal } from "@/components/marketing/reveal";
import { Marquee } from "@/components/marketing/marquee";
import { AnimatedScore } from "@/components/marketing/animated-score";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--color-bg)]">
      <BackgroundFX />
      <MarketingNav />
      <main>
        <Hero />
        <Sources />
        <Features />
        <ProductShot />
        <HowItWorks />
        <Comparison />
        <CTA />
      </main>
      <MarketingFooter />
    </div>
  );
}

function BackgroundFX() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[700px]"
        style={{
          backgroundImage:
            "radial-gradient(60% 60% at 50% 0%, color-mix(in oklch, var(--color-accent) 18%, transparent), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(var(--color-fg) 1px, transparent 1px), linear-gradient(90deg, var(--color-fg) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage: "radial-gradient(ellipse at top, black 30%, transparent 70%)",
        }}
      />
    </>
  );
}

function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 pt-14 sm:px-6 sm:pt-24">
      <div className="text-center">
        <Reveal>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-card)]/70 px-3 py-1 text-xs text-[var(--color-fg-muted)] shadow-sm backdrop-blur transition-colors hover:text-[var(--color-fg)]"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-accent)] opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
            </span>
            Free forever — no credit card
            <ArrowRight className="h-3 w-3" />
          </Link>
        </Reveal>
        <Reveal delay={0.05}>
          <h1 className="mx-auto mt-7 max-w-4xl text-balance text-[2.5rem] font-semibold leading-[1.02] tracking-[-0.02em] sm:text-6xl lg:text-7xl">
            Job search,{" "}
            <span className="relative inline-block text-[var(--color-fg)]">
              scoped
              <svg
                aria-hidden
                viewBox="0 0 220 14"
                className="absolute -bottom-2 left-0 right-0 h-2.5 w-full"
                preserveAspectRatio="none"
              >
                <path
                  d="M2 9 Q 60 2 110 8 T 218 5"
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </span>{" "}
            to your resume.
          </h1>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mx-auto mt-7 max-w-xl text-balance text-lg leading-relaxed text-[var(--color-fg-muted)]">
            Upload a resume. JobScope parses it, fans out to 7 free public job APIs, and ranks the
            best matches with a transparent 0–100 score.
          </p>
        </Reveal>
        <Reveal delay={0.15}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" variant="accent" asChild className="shadow-lg shadow-[oklch(0.65_0.18_260_/_0.25)]">
              <Link href="/signup">
                Start free <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">I have an account</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-[var(--color-fg-subtle)]">
            Email or Google · 30-second setup · your data stays yours
          </p>
        </Reveal>
      </div>

      <Reveal delay={0.25} y={28}>
        <div className="relative mx-auto mt-16 max-w-5xl sm:mt-20">
          <div
            aria-hidden
            className="absolute -inset-x-6 -inset-y-6 -z-10 rounded-[28px] bg-[oklch(0.65_0.18_260_/_0.14)] blur-3xl sm:-inset-x-10"
          />
          <DashboardMock />
        </div>
      </Reveal>
    </section>
  );
}

function DashboardMock() {
  const jobs = [
    { t: "Senior Backend Engineer", c: "Linear", l: "Remote · Europe", s: 94, m: ["Go", "Postgres", "gRPC"], miss: ["Kafka"] },
    { t: "Platform Engineer", c: "Vercel", l: "Remote · Worldwide", s: 88, m: ["TypeScript", "AWS", "K8s"], miss: ["Pulumi"] },
    { t: "Full-Stack Developer", c: "Notion", l: "San Francisco · Hybrid", s: 82, m: ["React", "Node"], miss: ["Rust"] },
    { t: "Staff Engineer, Infra", c: "Linear", l: "Remote · US", s: 76, m: ["Go", "Terraform"], miss: ["Spanner", "ClickHouse"] },
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl shadow-black/5 ring-1 ring-black/5">
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-4 py-2.5">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-[oklch(0.7_0.18_25)]" />
          <div className="h-2.5 w-2.5 rounded-full bg-[oklch(0.78_0.15_75)]" />
          <div className="h-2.5 w-2.5 rounded-full bg-[oklch(0.7_0.17_145)]" />
        </div>
        <div className="ml-3 flex-1">
          <div className="mx-auto flex max-w-xs items-center justify-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1 text-[11px] text-[var(--color-fg-subtle)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
            jobscope.app/dashboard
          </div>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
          live
        </span>
      </div>
      <div className="grid gap-0 sm:grid-cols-[200px_1fr]">
        <aside className="hidden border-r border-[var(--color-border)] bg-[var(--color-bg-subtle)]/50 p-3 sm:block">
          {[
            { l: "Dashboard", a: true },
            { l: "Jobs" },
            { l: "Resumes" },
            { l: "Tracker" },
            { l: "Settings" },
          ].map((n) => (
            <div
              key={n.l}
              className={`mb-0.5 rounded-md px-2.5 py-1.5 text-xs ${
                n.a ? "bg-[var(--color-card)] font-medium text-[var(--color-fg)] shadow-sm" : "text-[var(--color-fg-muted)]"
              }`}
            >
              {n.l}
            </div>
          ))}
        </aside>
        <div className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Your matches</div>
              <div className="text-[11px] text-[var(--color-fg-muted)]">
                Ranked against Backend Engineer Resume
              </div>
            </div>
            <div className="hidden gap-1 sm:flex">
              <div className="rounded-md border border-[var(--color-border)] px-2 py-1 text-[10px] text-[var(--color-fg-muted)]">
                Remote
              </div>
              <div className="rounded-md border border-[var(--color-accent)] bg-[var(--color-accent-soft)] px-2 py-1 text-[10px] text-[var(--color-accent)]">
                Senior
              </div>
            </div>
          </div>
          {jobs.map((j) => (
            <div
              key={j.t}
              className="flex items-center gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3"
            >
              <AnimatedScore value={j.s} size={56} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{j.t}</div>
                <div className="text-[11px] text-[var(--color-fg-muted)]">
                  {j.c} · {j.l}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {j.m.map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-[var(--color-success-soft)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-success)]"
                    >
                      {s}
                    </span>
                  ))}
                  {j.miss.map((s) => (
                    <span
                      key={s}
                      className="rounded-full border border-[var(--color-border-strong)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-fg-muted)]"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Sources() {
  const items = [
    "Remotive",
    "Arbeitnow",
    "The Muse",
    "USAJobs",
    "Adzuna",
    "Jooble",
    "JSearch",
    "Daily refresh",
    "Deduped",
    "Skill-tagged",
  ];
  return (
    <section className="border-y border-[var(--color-border)] bg-[var(--color-bg-subtle)]/30 py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="mb-4 text-center text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--color-fg-subtle)]">
          Aggregating from 7+ free job APIs
        </p>
        <Marquee items={items} />
      </div>
    </section>
  );
}

function Features() {
  const items = [
    {
      icon: Brain,
      title: "Resume-aware scoring",
      body: "Every job ranked 0–100 with a five-part breakdown — skills, seniority, location, experience, recency.",
    },
    {
      icon: Zap,
      title: "AI helpers, on demand",
      body: "Streaming cover letters, gap analyses, and interview prep — Gemini Flash with Groq fallback.",
    },
    {
      icon: Layers,
      title: "Tracker that drags",
      body: "Saved → Applied → Interview → Offer. Drag persists. Reminders nudge you on time.",
    },
    {
      icon: ShieldCheck,
      title: "PII never leaks",
      body: "Resume text is redacted before any LLM call. Your email and phone never leave your row.",
    },
    {
      icon: Mail,
      title: "Daily digest",
      body: "One email a day with your top 5 fresh matches above your minimum score. Or none if it's quiet.",
    },
    {
      icon: Sparkles,
      title: "Always free",
      body: "Built on free tiers — Atlas M0, R2, Vercel, Gemini. We pass the savings to you. Forever.",
    },
  ];
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
      <Reveal>
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline">What's inside</Badge>
          <h2 className="mt-4 text-balance text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">
            Six things, done well.
          </h2>
          <p className="mt-3 text-[var(--color-fg-muted)]">
            No bloat. No upsell. Every feature earns its rectangle.
          </p>
        </div>
      </Reveal>
      <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-border)] sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it, i) => (
          <Reveal key={it.title} delay={i * 0.04} className="bg-[var(--color-bg)]">
            <div className="group relative h-full p-7 transition-colors hover:bg-[var(--color-bg-subtle)]/60">
              <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-accent)] to-transparent opacity-0 transition-opacity group-hover:opacity-100"
              />
              <div className="mb-4 inline-grid h-10 w-10 place-items-center rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/15">
                <it.icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold tracking-tight">{it.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-fg-muted)]">
                {it.body}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function ProductShot() {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-24">
      <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <Reveal>
          <Badge variant="accent">Transparent scoring</Badge>
          <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            See exactly why a job scored 87.
          </h2>
          <p className="mt-3 text-[var(--color-fg-muted)]">
            No black box. The breakdown panel shows skill overlap, seniority adjacency, location
            fit, experience delta, and posting recency — point by point.
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            {[
              ["Skills", "50", "Set intersection vs. job's extracted skills."],
              ["Seniority", "20", "Junior↔Mid↔Senior↔Staff adjacency table."],
              ["Location", "15", "Remote = full credit; otherwise city-aware."],
              ["Experience", "10", "Years vs. inferred role expectation."],
              ["Recency", "5", "Decays from 5 over the past 50 days."],
            ].map(([label, weight, desc]) => (
              <li
                key={label}
                className="flex flex-col gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)]/40 p-3 sm:flex-row sm:items-center sm:gap-4 sm:border-0 sm:bg-transparent sm:p-0"
              >
                <div className="flex items-center gap-2 sm:w-32 sm:shrink-0">
                  <span className="font-medium text-[var(--color-fg)]">{label}</span>
                  <span className="rounded-md bg-[var(--color-bg-subtle)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-fg-muted)]">
                    {weight}
                  </span>
                </div>
                <span className="text-[var(--color-fg-muted)]">{desc}</span>
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={0.1} y={28}>
          <BreakdownCard />
        </Reveal>
      </div>
    </section>
  );
}

function BreakdownCard() {
  const rows = [
    { k: "Skills", v: 44, max: 50, color: "var(--color-success)" },
    { k: "Seniority", v: 20, max: 20, color: "var(--color-accent)" },
    { k: "Location", v: 15, max: 15, color: "var(--color-accent)" },
    { k: "Experience", v: 6, max: 10, color: "var(--color-warning)" },
    { k: "Recency", v: 2, max: 5, color: "var(--color-fg-muted)" },
  ];
  return (
    <div className="relative">
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-xl shadow-black/5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-[var(--color-fg-subtle)]">
              Match breakdown
            </div>
            <div className="mt-1 text-lg font-semibold">Senior Backend Engineer · Linear</div>
          </div>
          <AnimatedScore value={87} size={68} />
        </div>
        <div className="mt-5 space-y-3">
          {rows.map((r) => (
            <div key={r.k}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--color-fg-muted)]">{r.k}</span>
                <span className="font-mono tabular-nums">
                  {r.v}/{r.max}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(r.v / r.max) * 100}%`, background: r.color }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 border-t border-[var(--color-border)] pt-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-fg-subtle)]">
            Matched skills
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {["Go", "PostgreSQL", "gRPC", "Kubernetes", "Redis", "AWS", "Terraform"].map((s) => (
              <span
                key={s}
                className="rounded-full bg-[var(--color-success-soft)] px-2 py-0.5 font-mono text-[10px] text-[var(--color-success)]"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    {
      icon: FileText,
      n: "01",
      t: "Upload your resume",
      d: "Drop a PDF or DOCX. We parse skills, experience, and seniority in under 8 seconds.",
    },
    {
      icon: Search,
      n: "02",
      t: "We aggregate jobs",
      d: "A nightly cron pulls fresh listings from 7 sources, dedupes them, tags each with skills.",
    },
    {
      icon: Brain,
      n: "03",
      t: "Score, rank, surface",
      d: "Your dashboard shows ranked matches with green-pill matched skills and explainable scores.",
    },
    {
      icon: Send,
      n: "04",
      t: "Apply with help",
      d: "Generate a cover letter, spot skill gaps, prep for the interview — without leaving the tab.",
    },
  ];
  return (
    <section id="how" className="border-t border-[var(--color-border)] bg-[var(--color-bg-subtle)]/40 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="outline">How it works</Badge>
            <h2 className="mt-4 text-balance text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">
              Upload once. Get matches every morning.
            </h2>
          </div>
        </Reveal>
        <div className="relative mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div
            aria-hidden
            className="absolute left-0 right-0 top-9 hidden h-px bg-gradient-to-r from-transparent via-[var(--color-border-strong)] to-transparent lg:block"
          />
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.06}>
              <div className="relative h-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--color-fg)] text-[var(--color-bg)]">
                    <s.icon className="h-4 w-4" />
                  </span>
                  <span className="font-mono text-xs text-[var(--color-fg-subtle)]">{s.n}</span>
                </div>
                <h3 className="text-base font-semibold">{s.t}</h3>
                <p className="mt-1.5 text-sm text-[var(--color-fg-muted)]">{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Comparison() {
  const rows = [
    ["Resume-aware ranking", true, false, false],
    ["Free forever", true, false, false],
    ["Aggregates 7 sources", true, false, true],
    ["Drag-drop tracker", true, true, false],
    ["AI cover letters", true, true, false],
    ["No tracking ads", true, false, false],
    ["Daily digest at your time", true, false, true],
  ];
  return (
    <section className="mx-auto max-w-5xl px-4 sm:px-6 py-16 sm:py-24">
      <Reveal>
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline">Why JobScope</Badge>
          <h2 className="mt-4 text-balance text-4xl font-semibold tracking-[-0.02em]">
            Built for one job: yours.
          </h2>
        </div>
      </Reveal>
      <Reveal delay={0.05}>
        <div className="mt-12 overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
          <div className="min-w-[560px]">
          <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)]/60 px-5 py-3 text-xs font-medium uppercase tracking-wider text-[var(--color-fg-subtle)]">
            <span />
            <span className="text-center text-[var(--color-accent)]">JobScope</span>
            <span className="text-center">LinkedIn Premium</span>
            <span className="text-center">Job board #N</span>
          </div>
          {rows.map(([label, a, b, c], i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: stable
              key={i}
              className="grid grid-cols-[1.5fr_1fr_1fr_1fr] items-center border-b border-[var(--color-border)] px-5 py-3 text-sm last:border-b-0"
            >
              <span className="text-[var(--color-fg)]">{label}</span>
              <span className="flex justify-center">
                {a ? (
                  <Check className="h-4 w-4 text-[var(--color-success)]" />
                ) : (
                  <X className="h-4 w-4 text-[var(--color-fg-subtle)]" />
                )}
              </span>
              <span className="flex justify-center">
                {b ? (
                  <Check className="h-4 w-4 text-[var(--color-fg-muted)]" />
                ) : (
                  <X className="h-4 w-4 text-[var(--color-fg-subtle)]" />
                )}
              </span>
              <span className="flex justify-center">
                {c ? (
                  <Check className="h-4 w-4 text-[var(--color-fg-muted)]" />
                ) : (
                  <X className="h-4 w-4 text-[var(--color-fg-subtle)]" />
                )}
              </span>
            </div>
          ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function CTA() {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-24">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] px-6 py-12 text-center shadow-xl shadow-black/5 sm:px-12 sm:py-16 lg:px-16">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 opacity-90"
            style={{
              background:
                "radial-gradient(80% 60% at 50% 0%, color-mix(in oklch, var(--color-accent) 20%, transparent), transparent 70%)",
            }}
          />
          <Trophy className="mx-auto h-8 w-8 text-[var(--color-accent)]" />
          <h2 className="mx-auto mt-5 max-w-2xl text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl lg:text-5xl">
            Stop scrolling. Start matching.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[var(--color-fg-muted)]">
            Sign up in 30 seconds. Your first ranked dashboard is two clicks away.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" variant="accent" asChild>
              <Link href="/signup">
                <Bookmark className="h-4 w-4" /> Create your free account
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/pricing">See what's free</Link>
            </Button>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
