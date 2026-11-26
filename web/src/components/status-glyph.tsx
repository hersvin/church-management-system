import { cn } from "@/lib/utils";

/**
 * The admin's ink vocabulary for state, so status never depends on hue:
 * done = filled dot, active = half-filled ring, waiting = empty ring, off = dashed ring,
 * failed = the only red mark, a red dot with a paper cross.
 */
export type GlyphState = "done" | "active" | "waiting" | "off" | "failed";

export interface StatusGlyphProps {
  state: GlyphState;
  /** Set only when the glyph carries meaning with no visible text beside it. */
  label?: string;
  /** A slow pulse for something happening right now. Stops under reduced motion. */
  pulse?: boolean;
  className?: string;
}

export function StatusGlyph({ state, label, pulse = false, className }: StatusGlyphProps) {
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true as const };
  return (
    <svg
      viewBox="0 0 12 12"
      width={12}
      height={12}
      className={cn(
        "inline-block size-3 shrink-0",
        state === "failed" ? "text-destructive" : state === "off" ? "text-muted-foreground" : "text-foreground",
        pulse && "motion-safe:animate-[ink-pulse_1.6s_ease-in-out_infinite]",
        className,
      )}
      {...a11y}
    >
      {state === "done" && <circle cx="6" cy="6" r="5" fill="currentColor" />}
      {state === "active" && (
        <>
          <circle cx="6" cy="6" r="4.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M6 1.25a4.75 4.75 0 0 1 0 9.5z" fill="currentColor" />
        </>
      )}
      {state === "waiting" && <circle cx="6" cy="6" r="4.75" fill="none" stroke="currentColor" strokeWidth="1.5" />}
      {state === "off" && <circle cx="6" cy="6" r="4.75" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 1.6" />}
      {state === "failed" && (
        <>
          <circle cx="6" cy="6" r="5.5" fill="currentColor" />
          <path d="M4 4l4 4M8 4l-4 4" stroke="var(--background)" strokeWidth="1.4" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}
