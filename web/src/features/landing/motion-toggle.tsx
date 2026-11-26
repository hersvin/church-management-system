"use client";

import { PauseIcon, PlayIcon } from "@/components/icons";

/**
 * Small icon-only pause and play control for motion that runs longer than five seconds
 * (WCAG 2.2.2). `name` says what it stops, for example "photos from church life".
 */
export function MotionToggle({ paused, onToggle, name, className }: { paused: boolean; onToggle: () => void; name: string; className?: string }) {
  return (
    <button
      type="button"
      className={["lp-motionToggle", className].filter(Boolean).join(" ")}
      aria-pressed={paused}
      aria-label={`${paused ? "Play" : "Pause"} ${name}`}
      title={paused ? "Play" : "Pause"}
      onClick={onToggle}
    >
      {paused ? <PlayIcon /> : <PauseIcon />}
    </button>
  );
}
