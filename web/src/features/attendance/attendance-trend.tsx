"use client";

import { motion } from "motion/react";
import { EASE_OUT } from "@/components/motion";
import { Skeleton } from "@/components/ui/skeleton";
import type { AttendanceStats } from "./api";
import { barPercents } from "./format";

const weekLabel = (key: string) =>
  new Date(`${key}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/**
 * Weekly attendance as thin ink bars on a hairline baseline. Each bar rises in turn;
 * the stat line under it carries the numbers so nothing depends on reading bar heights.
 */
export function AttendanceTrend({ stats }: { stats: AttendanceStats | undefined }) {
  if (!stats) return <Skeleton className="h-40 w-full" />;
  const weeks = stats.weeks;
  const heights = barPercents(weeks.map((w) => w.attendance));
  const counted = weeks.filter((w) => w.attendance > 0);
  const average = counted.length ? Math.round(counted.reduce((sum, w) => sum + w.attendance, 0) / counted.length) : 0;
  const checkIns = weeks.reduce((sum, w) => sum + w.checkIns, 0);
  const peak = Math.max(0, ...weeks.map((w) => w.attendance));

  return (
    <div className="flex flex-col gap-2">
      <div className="border-border relative flex h-36 items-end justify-between gap-1 border-b" role="img" aria-label={`Weekly attendance, peak ${peak}, average ${average}`}>
        {weeks.map((w, i) => (
          <div key={w.weekOf} className="group relative flex h-full flex-1 flex-col items-center justify-end">
            <span className="font-data text-muted-foreground pointer-events-none mb-1 text-[10px] opacity-0 transition-opacity group-hover:opacity-100">
              {w.attendance}
            </span>
            <motion.div
              className="bg-foreground w-1.5 rounded-t-[1px]"
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(heights[i], w.attendance > 0 ? 2 : 0)}%` }}
              transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.05 + i * 0.05 }}
              title={`Week of ${weekLabel(w.weekOf)}: ${w.attendance} attended, ${w.checkIns} checked in`}
            />
          </div>
        ))}
      </div>
      <div className="font-data text-muted-foreground flex justify-between text-[11px]">
        <span>{weeks[0] ? weekLabel(weeks[0].weekOf) : ""}</span>
        <span>{weeks.length > 2 ? weekLabel(weeks[Math.floor(weeks.length / 2)].weekOf) : ""}</span>
        <span>This week</span>
      </div>
      <p className="font-data text-xs">
        avg {average}
        <span className="text-muted-foreground"> · </span>peak {peak}
        <span className="text-muted-foreground"> · </span>
        {checkIns} checked in
      </p>
    </div>
  );
}
