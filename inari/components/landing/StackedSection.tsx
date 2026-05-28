"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  index: number;
  total: number;
  className?: string;
  innerClassName?: string;
  id?: string;
};

export function StackedSection({
  children,
  index,
  total,
  className = "",
  innerClassName = "",
  id,
}: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const isLast = index === total - 1;

  const scale = useTransform(
    scrollYProgress,
    [0, 0.6, 1],
    prefersReducedMotion || isLast ? [1, 1, 1] : [1, 1, 0.92],
  );
  const opacity = useTransform(
    scrollYProgress,
    [0, 0.6, 1],
    prefersReducedMotion || isLast ? [1, 1, 1] : [1, 1, 0.7],
  );
  const borderRadius = useTransform(
    scrollYProgress,
    [0, 0.6, 1],
    prefersReducedMotion || isLast ? [0, 0, 0] : [0, 0, 28],
  );

  return (
    <section
      ref={ref}
      id={id}
      className={`sticky top-0 h-svh w-full overflow-hidden ${className}`}
      style={{ zIndex: index + 1 }}
    >
      <motion.div
        style={{
          scale,
          opacity,
          borderRadius,
          transformOrigin: "50% 0%",
          willChange: "transform, opacity",
        }}
        className={`relative h-full w-full ${innerClassName}`}
      >
        {children}
      </motion.div>
    </section>
  );
}
