import { cn } from "@/lib/utils";

function JobScopeWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex select-none text-[var(--color-fg)] font-semibold tracking-[-0.02em] text-[19px] leading-none",
        className,
      )}
    >
      JobScope
    </span>
  );
}

export function LogoMark({
  className,
  size = 28,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      <rect
        x="1.25"
        y="1.25"
        width="29.5"
        height="29.5"
        rx="7.5"
        fill="var(--color-fg)"
      />
      <path
        d="M11 9.5 L11 19 a3.2 3.2 0 0 1 -3.2 3.2 H6.5"
        stroke="var(--color-bg)"
        strokeWidth="2.2"
        strokeLinecap="square"
        fill="none"
      />
      <circle
        cx="20"
        cy="16"
        r="4.6"
        stroke="var(--color-bg)"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M23.4 19.4 L26.2 22.2"
        stroke="var(--color-bg)"
        strokeWidth="2"
        strokeLinecap="square"
      />
      <circle cx="20" cy="16" r="1.2" fill="var(--color-accent)" />
    </svg>
  );
}

export function Logo({
  className,
  size = 28,
  showWordmark = true,
}: {
  className?: string;
  size?: number;
  showWordmark?: boolean;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-2.5", className)}
    >
      <LogoMark size={size} />
      {showWordmark && <JobScopeWordmark />}
    </span>
  );
}
