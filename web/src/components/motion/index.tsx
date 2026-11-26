"use client";

import { animate, motion, useReducedMotionConfig, type HTMLMotionProps, type Variants } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Shared easing so every animation in the app feels like one system. */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

export function FadeIn({ delay = 0, y = 8, ...props }: HTMLMotionProps<"div"> & { delay?: number; y?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE_OUT, delay }}
      {...props}
    />
  );
}

const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
};

const staggerChild: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE_OUT } },
};

export function Stagger(props: HTMLMotionProps<"div">) {
  return <motion.div variants={staggerParent} initial="hidden" animate="show" {...props} />;
}

export function StaggerItem(props: HTMLMotionProps<"div">) {
  return <motion.div variants={staggerChild} {...props} />;
}

/** Table body whose rows fade in one after another. Pair with MotionRow. */
export function MotionTableBody({ className, ...props }: HTMLMotionProps<"tbody">) {
  return (
    <motion.tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      variants={staggerParent}
      initial="hidden"
      animate="show"
      {...props}
    />
  );
}

/** Same look as the shadcn TableRow, with a staggered entrance. */
export function MotionRow({ className, ...props }: HTMLMotionProps<"tr">) {
  return (
    <motion.tr
      data-slot="table-row"
      className={cn("hover:bg-muted/50 border-b transition-colors", className)}
      variants={staggerChild}
      {...props}
    />
  );
}

const format = (n: number) => Math.round(n).toLocaleString("en-US");

/** Counts up to `value`. Jumps straight to the value when the user prefers reduced motion. */
export function AnimatedNumber({ value, duration = 0.8 }: { value: number; duration?: number }) {
  const reduced = useReducedMotionConfig() ?? false;
  const [display, setDisplay] = useState(reduced ? value : 0);
  const from = useRef(reduced ? value : 0);

  useEffect(() => {
    if (reduced) {
      from.current = value;
      return;
    }
    const controls = animate(from.current, value, {
      duration,
      ease: EASE_OUT,
      onUpdate: (latest) => setDisplay(latest),
      onComplete: () => {
        from.current = value;
      },
    });
    return () => controls.stop();
  }, [value, duration, reduced]);

  return (
    <span aria-label={format(value)} className="font-data">
      <span aria-hidden>{format(reduced ? value : display)}</span>
    </span>
  );
}
