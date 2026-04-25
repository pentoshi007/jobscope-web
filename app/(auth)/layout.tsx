import Link from "next/link";
import { Sparkles, ShieldCheck, Zap } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { AnimatedScore } from "@/components/marketing/animated-score";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <div className="relative flex flex-col px-6 py-8 sm:px-10">
        <Link href="/" className="inline-flex w-fit">
          <Logo />
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          {children}
        </div>
        <p className="text-center text-xs text-[var(--color-fg-subtle)]">
          By continuing you accept our terms · this product is and stays free.
        </p>
      </div>
      <AuthShowcase />
    </div>
  );
}

function AuthShowcase() {
  return (
    <div className="relative hidden overflow-hidden border-l border-[var(--color-border)] lg:block">
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 30% 25%, color-mix(in oklch, var(--color-accent) 22%, transparent), transparent 70%), linear-gradient(160deg, var(--color-bg-subtle), var(--color-bg))",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(var(--color-fg) 1px, transparent 1px), linear-gradient(90deg, var(--color-fg) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(ellipse at 30% 25%, black 35%, transparent 75%)",
        }}
      />

      <div className="relative flex h-full flex-col justify-between p-12">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-card)]/70 px-3 py-1 text-xs text-[var(--color-fg-muted)] shadow-sm backdrop-blur">
            <Sparkles className="h-3 w-3 text-[var(--color-accent)]" />
            10,000+ live jobs · ranked for you
          </div>
          <h2 className="mt-6 max-w-md text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.02em]">
            Stop scrolling.
            <br />
            <span className="text-[var(--color-accent)]">Start matching.</span>
          </h2>
          <p className="mt-4 max-w-sm text-[var(--color-fg-muted)]">
            Upload one resume, get every relevant job from 7 sources ranked by a transparent score —
            never a black box.
          </p>
        </div>

        <PreviewCard />

        <div className="grid gap-3">
          <blockquote className="max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]/60 p-4 text-sm leading-relaxed backdrop-blur">
            <span className="text-[var(--color-fg)]">
              "I stopped doomscrolling LinkedIn. Now I check JobScope once with my coffee."
            </span>
            <footer className="mt-2 text-xs text-[var(--color-fg-muted)]">
              — Backend engineer, Bengaluru
            </footer>
          </blockquote>
          <div className="grid grid-cols-3 gap-3">
            <Stat icon={<ShieldCheck className="h-3.5 w-3.5" />} k="PII redacted" v="before LLM" />
            <Stat icon={<Zap className="h-3.5 w-3.5" />} k="Daily refresh" v="all sources" />
            <Stat icon={<Sparkles className="h-3.5 w-3.5" />} k="Free" v="forever" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, k, v }: { icon: React.ReactNode; k: string; v: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)]/60 p-3 backdrop-blur">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
        {icon}
        {k}
      </div>
      <div className="mt-1 text-sm font-medium">{v}</div>
    </div>
  );
}

function PreviewCard() {
  const jobs = [
    { t: "Senior Backend Engineer", c: "Linear · Remote", s: 94, m: ["Go", "Postgres", "gRPC"] },
    { t: "Platform Engineer", c: "Vercel · Remote", s: 88, m: ["TypeScript", "K8s"] },
    { t: "Full-Stack Developer", c: "Notion · SF", s: 82, m: ["React", "Node"] },
  ];
  return (
    <div className="my-6 max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]/70 p-4 shadow-xl shadow-black/10 backdrop-blur">
      <div className="mb-3 flex items-center justify-between text-xs">
        <span className="font-mono text-[var(--color-fg-subtle)]">your matches · today</span>
        <span className="rounded-full bg-[var(--color-success-soft)] px-2 py-0.5 font-mono text-[10px] text-[var(--color-success)]">
          ↑ 12 new
        </span>
      </div>
      <div className="space-y-2">
        {jobs.map((j) => (
          <div
            key={j.t}
            className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/60 p-2.5"
          >
            <AnimatedScore value={j.s} size={44} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{j.t}</div>
              <div className="truncate text-[11px] text-[var(--color-fg-muted)]">{j.c}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {j.m.map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-[var(--color-success-soft)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-success)]"
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
  );
}
