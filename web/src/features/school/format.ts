import type { AttendanceStatus, ClassAudience } from "@cms/shared";
import { dayKey } from "@/lib/datetime";

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Audiences step through ink tones on the class card rule; the chip names them. */
export const AUDIENCE_META: Record<ClassAudience, { label: string; accent: string; chip: string }> = {
  CHILDREN: { label: "Children", accent: "bg-foreground/40", chip: "border border-border bg-background text-foreground" },
  YOUTH: { label: "Youth", accent: "bg-foreground/70", chip: "border border-border bg-background text-foreground" },
  ADULTS: { label: "Adults", accent: "bg-foreground", chip: "bg-foreground text-background" },
};

/** Present prints solid, late in half tone, excused as a dashed outline; absent is the one red mark. */
export const ATTENDANCE_META: Record<AttendanceStatus, { label: string; short: string; active: string }> = {
  PRESENT: { label: "Present", short: "P", active: "bg-foreground text-background" },
  LATE: { label: "Late", short: "L", active: "bg-foreground/60 text-background" },
  ABSENT: { label: "Absent", short: "A", active: "bg-destructive text-white" },
  EXCUSED: { label: "Excused", short: "E", active: "bg-background text-foreground border border-dashed border-foreground" },
};

function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function scheduleLine(day: number | null, start: string | null, end: string | null): string {
  if (day === null || day === undefined) return "No set schedule";
  const days = `${WEEKDAYS[day]}s`;
  if (!start) return days;
  return end ? `${days}, ${to12h(start)} to ${to12h(end)}` : `${days}, ${to12h(start)}`;
}

export type RateTone = "good" | "fair" | "low" | "none";

export function rateTone(rate: number | null): RateTone {
  if (rate === null) return "none";
  if (rate >= 85) return "good";
  if (rate >= 70) return "fair";
  return "low";
}

export const RATE_CLASSES: Record<RateTone, { text: string; bar: string }> = {
  good: { text: "text-foreground", bar: "bg-foreground" },
  fair: { text: "text-muted-foreground", bar: "bg-foreground/50" },
  low: { text: "text-destructive", bar: "bg-destructive" },
  none: { text: "text-muted-foreground", bar: "bg-foreground/20" },
};

/** Terms are stored as calendar dates (UTC midnight); compare them as dates. */
export function termState(startsOn: string, endsOn: string, today = new Date()): "upcoming" | "current" | "ended" {
  const t = dayKey(today);
  if (t < startsOn.slice(0, 10)) return "upcoming";
  if (t > endsOn.slice(0, 10)) return "ended";
  return "current";
}
