import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-10">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-[var(--color-fg)] text-[var(--color-bg)]">
            <Sparkles className="h-4 w-4" />
          </span>
          JobScope
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">{children}</div>
        <p className="text-center text-xs text-[var(--color-fg-subtle)]">
          By continuing you accept our terms · this product is and stays free.
        </p>
      </div>
      <div
        className="relative hidden lg:block"
        style={{
          background:
            "radial-gradient(80% 60% at 50% 30%, color-mix(in oklch, var(--color-accent) 22%, transparent), transparent), linear-gradient(180deg, var(--color-bg-subtle), var(--color-bg))",
        }}
      >
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(var(--color-fg) 1px, transparent 1px), linear-gradient(90deg, var(--color-fg) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative flex h-full flex-col justify-end p-12">
          <blockquote className="max-w-md text-2xl font-semibold leading-tight tracking-tight">
            "I stopped doomscrolling LinkedIn. Now I check JobScope once with my coffee."
          </blockquote>
          <p className="mt-3 text-sm text-[var(--color-fg-muted)]">— Backend engineer, Bengaluru</p>
        </div>
      </div>
    </div>
  );
}
