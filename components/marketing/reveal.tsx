"use client";
import { motion, useReducedMotion } from "motion/react";
import type { ComponentProps } from "react";

export function Reveal({
  children,
  delay = 0,
  y = 12,
  className,
  ...rest
}: { delay?: number; y?: number } & ComponentProps<typeof motion.div>) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
