"use client";
import { motion } from "motion/react";

export function Marquee({ items }: { items: string[] }) {
  const loop = [...items, ...items];
  return (
    <div
      className="relative overflow-hidden"
      style={{
        maskImage:
          "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)",
      }}
    >
      <motion.div
        className="flex gap-12 whitespace-nowrap py-2 text-sm font-medium text-[var(--color-fg-muted)]"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 32, ease: "linear", repeat: Number.POSITIVE_INFINITY }}
      >
        {loop.map((s, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: marquee
          <span key={i} className="inline-flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-[var(--color-fg-subtle)]" />
            {s}
          </span>
        ))}
      </motion.div>
    </div>
  );
}
