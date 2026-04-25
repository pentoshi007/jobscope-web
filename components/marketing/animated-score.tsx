"use client";
import { motion, useInView, useMotionValue, useTransform, animate } from "motion/react";
import { useEffect, useRef } from "react";

export function AnimatedScore({ value, size = 80 }: { value: number; size?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const mv = useMotionValue(0);
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const dashOffset = useTransform(mv, (v) => c * (1 - v / 100));
  const display = useTransform(mv, (v) => Math.round(v).toString());

  useEffect(() => {
    if (!inView) return;
    const ctrl = animate(mv, value, { duration: 1.2, ease: [0.22, 1, 0.36, 1] });
    return () => ctrl.stop();
  }, [inView, value, mv]);

  const color =
    value >= 80
      ? "var(--color-success)"
      : value >= 60
        ? "var(--color-accent)"
        : "var(--color-warning)";

  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg ref={ref} width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border)" strokeWidth={5} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={c}
          style={{ strokeDashoffset: dashOffset }}
        />
      </svg>
      <motion.span
        className="absolute font-mono text-base font-semibold tabular-nums"
        style={{ color }}
      >
        {display}
      </motion.span>
    </div>
  );
}
