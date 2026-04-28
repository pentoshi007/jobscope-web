import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MarketingNav, MarketingFooter } from "@/components/marketing/nav";
import { Reveal } from "@/components/marketing/reveal";

export const metadata = { title: "Pricing — Always free" };

const FEATURES = [
  "Unlimited resumes & ATS scoring",
  "Daily ingestion from 7 job APIs",
  "Resume-aware match scoring (0–100)",
  "AI cover letters (streaming)",
  "Skill gap & interview prep",
  "Drag-drop application tracker",
  "Daily digest emails (your threshold)",
  "Dark mode + keyboard nav",
  "Export and delete your data anytime",
  "No tracking, no ads, no upsell",
];

export default function PricingPage() {
  return (
    <div className="relative min-h-screen bg-[var(--color-bg)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[500px]"
        style={{
          backgroundImage:
            "radial-gradient(60% 60% at 50% 0%, color-mix(in oklch, var(--color-accent) 14%, transparent), transparent 70%)",
        }}
      />
      <MarketingNav />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20 text-center">
        <Reveal>
          <Badge variant="accent" className="mb-5">
            <Sparkles className="mr-1.5 h-3 w-3" /> Always free
          </Badge>
          <h1 className="text-balance text-5xl font-semibold tracking-[-0.02em] sm:text-6xl">
            One tier. Zero rupees.
          </h1>
          <p className="mx-auto mt-5 max-w-md text-balance text-[var(--color-fg-muted)]">
            JobScope runs on generous free tiers for storage, hosting, AI, and email. We pass the
            savings on to you — forever.
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="relative mt-14">
            <div
              aria-hidden
              className="absolute -inset-4 -z-10 rounded-3xl bg-[oklch(0.65_0.18_260_/_0.16)] blur-3xl"
            />
            <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-left shadow-xl shadow-black/5">
              <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--color-border)] pb-7">
                <div>
                  <div className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
                    Personal
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-6xl font-semibold tracking-tight">₹0</span>
                    <span className="text-[var(--color-fg-muted)]">/ forever</span>
                  </div>
                </div>
                <Button size="lg" variant="accent" asChild>
                  <Link href="/signup">Create your account</Link>
                </Button>
              </div>
              <ul className="mt-7 grid gap-3 sm:grid-cols-2">
                {FEATURES.map((f, i) => (
                  <li
                    key={f}
                    className="flex items-start gap-2.5 text-sm"
                    style={{
                      animation: `fade-in 0.4s ease-out ${i * 0.03}s backwards`,
                    }}
                  >
                    <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[var(--color-success-soft)] text-[var(--color-success)]">
                      <Check className="h-3 w-3" />
                    </span>
                    <span className="text-[var(--color-fg)]">{f}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-7 border-t border-[var(--color-border)] pt-5 text-center text-xs text-[var(--color-fg-subtle)]">
                If we ever can't keep this free, we'll tell you long before. Promise.
              </p>
            </div>
          </div>
        </Reveal>
      </main>
      <MarketingFooter />
    </div>
  );
}
