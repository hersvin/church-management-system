/**
 * Pure scheduling helpers shared by the API (conflict checks, series creation)
 * and the web app (previewing repeats). All math is done in UTC.
 */

export const REPEAT_FREQUENCIES = ["WEEKLY", "BIWEEKLY", "MONTHLY"] as const;
export type RepeatFrequency = (typeof REPEAT_FREQUENCIES)[number];

/** Upper bound on occurrences created for one series. */
export const MAX_OCCURRENCES = 52;

export interface TimeRange {
  startsAt: Date;
  endsAt: Date;
}

export interface RepeatRule {
  frequency: RepeatFrequency;
  /** Inclusive: occurrences starting on this calendar day (UTC) are kept. */
  until: Date;
}

/** Half-open ranges: back-to-back bookings do not overlap. */
export function overlaps(a: TimeRange, b: TimeRange): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

export function findOverlaps<T extends TimeRange>(
  candidates: TimeRange[],
  existing: T[],
): { candidate: TimeRange; conflicts: T[] }[] {
  return candidates
    .map((candidate) => ({ candidate, conflicts: existing.filter((e) => overlaps(candidate, e)) }))
    .filter((r) => r.conflicts.length > 0);
}

function endOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

function nthStart(start: Date, frequency: RepeatFrequency, n: number): Date | null {
  if (frequency === "WEEKLY" || frequency === "BIWEEKLY") {
    const days = (frequency === "WEEKLY" ? 7 : 14) * n;
    return new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
  }
  const candidate = new Date(
    Date.UTC(
      start.getUTCFullYear(),
      start.getUTCMonth() + n,
      start.getUTCDate(),
      start.getUTCHours(),
      start.getUTCMinutes(),
      start.getUTCSeconds(),
    ),
  );
  // Months without that day (for example February 31) roll over; skip them.
  return candidate.getUTCDate() === start.getUTCDate() ? candidate : null;
}

export function expandOccurrences(startsAt: Date, endsAt: Date, repeat?: RepeatRule): TimeRange[] {
  if (!repeat) return [{ startsAt, endsAt }];
  const duration = endsAt.getTime() - startsAt.getTime();
  const limit = endOfUtcDay(repeat.until);
  const result: TimeRange[] = [];

  for (let n = 0; result.length < MAX_OCCURRENCES; n += 1) {
    const start = nthStart(startsAt, repeat.frequency, n);
    if (start === null) continue;
    if (start > limit) break;
    result.push({ startsAt: start, endsAt: new Date(start.getTime() + duration) });
    if (n > MAX_OCCURRENCES * 2) break;
  }
  return result;
}
