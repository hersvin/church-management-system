"use client";

import { motion } from "motion/react";
import { EASE_OUT } from "@/components/motion";
import { cn } from "@/lib/utils";
import { RATE_CLASSES, rateTone } from "./format";

/** Attendance percentage with an animated bar, colored by how healthy it is. */
export function RateBar({ rate, label = "Attendance", className }: { rate: number | null; label?: string; className?: string }) {
  const tone = RATE_CLASSES[rateTone(rate)];
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("font-medium font-data", tone.text)}>{rate === null ? "No records" : `${rate}%`}</span>
      </div>
      <div className="bg-muted h-1.5 overflow-hidden rounded-full" role="meter" aria-valuenow={rate ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <motion.div
          className={cn("h-full rounded-full", tone.bar)}
          initial={{ width: 0 }}
          animate={{ width: `${rate ?? 0}%` }}
          transition={{ duration: 0.8, ease: EASE_OUT }}
        />
      </div>
    </div>
  );
}
