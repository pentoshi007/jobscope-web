import { cn } from "@/lib/utils";

export function ScoreDonut({
  value,
  size = 56,
  stroke = 5,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  className?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - v / 100);
  const color =
    v >= 80
      ? "var(--color-success)"
      : v >= 60
        ? "var(--color-accent)"
        : v >= 40
          ? "var(--color-warning)"
          : "var(--color-danger)";

  return (
    <div className={cn("relative inline-grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 600ms ease" }}
        />
      </svg>
      <span
        className="absolute font-mono text-sm font-semibold tabular-nums"
        style={{ color }}
      >
        {v}
      </span>
    </div>
  );
}
