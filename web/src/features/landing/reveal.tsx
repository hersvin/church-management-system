"use client";

import { motion, type HTMLMotionProps, type Variants } from "motion/react";
import { EASE_OUT } from "@/components/motion";

/** One entrance per section: fade and rise once, the first time a quarter of it is on screen. */
const VIEWPORT = { once: true, amount: 0.25 } as const;

export function Reveal({ delay = 0, y = 20, ...props }: HTMLMotionProps<"div"> & { delay?: number; y?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT}
      transition={{ duration: 0.4, ease: EASE_OUT, delay }}
      {...props}
    />
  );
}

const group: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const rise: Variants = {
  hidden: { opacity: 0, y: 16 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT } },
};

const settle: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  shown: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: EASE_OUT } },
};

/** A list whose items arrive one after another, 70 ms apart. */
export function RevealList({ ordered = false, ...props }: HTMLMotionProps<"ul"> & { ordered?: boolean }) {
  const shared = { variants: group, initial: "hidden", whileInView: "shown", viewport: VIEWPORT } as const;
  return ordered ? <motion.ol {...shared} {...(props as HTMLMotionProps<"ol">)} /> : <motion.ul {...shared} {...props} />;
}

/** An item of RevealList. `settle` scales in, for round faces; the default rises. */
export function RevealItem({ settle: scaleIn = false, ...props }: HTMLMotionProps<"li"> & { settle?: boolean }) {
  return <motion.li variants={scaleIn ? settle : rise} {...props} />;
}
