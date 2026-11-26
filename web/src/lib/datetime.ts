/** Local-time helpers. The API stores UTC; the UI shows and edits times in the viewer's timezone. */

const pad = (n: number) => String(n).padStart(2, "0");

// Newer ICU versions put a narrow no-break space before AM/PM; use a plain space for consistent text.
const clean = (s: string) => s.replace(/ /g, " ");

export function toLocalInput(value: string | Date): string {
  const d = new Date(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Converts a datetime-local value (interpreted as local time) to an ISO string. */
export function fromLocalInput(value: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function dayKey(value: string | Date): string {
  const d = new Date(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatTime(value: string | Date): string {
  return clean(new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
}

export function formatDateTime(value: string | Date): string {
  return clean(
    new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
  );
}

export function formatDayLong(value: string | Date): string {
  return new Date(value).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export function formatTimeRange(start: string | Date, end: string | Date): string {
  return dayKey(start) === dayKey(end)
    ? `${formatTime(start)} to ${formatTime(end)}`
    : `${formatDateTime(start)} to ${formatDateTime(end)}`;
}

export interface GridDay {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
}

/** 42 days (6 weeks) covering the month of `anchor`, starting on Sunday. */
export function monthGrid(anchor: Date): GridDay[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const today = dayKey(new Date());
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return { date, inMonth: date.getMonth() === anchor.getMonth(), isToday: dayKey(date) === today };
  });
}

export function groupByDay<T extends { startsAt: string }>(items: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of [...items].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
    const key = dayKey(item.startsAt);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}
