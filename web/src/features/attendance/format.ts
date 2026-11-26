import { dayKey } from "@/lib/datetime";

type Person = { id: string; firstName: string; lastName: string } | null;

export interface NamedCheckIn {
  kind: "ATTENDEE" | "CHILD";
  member: Person;
  guestName: string | null;
  checkedOutAt: string | null;
}

export type CheckInFilter = "all" | "kids" | "in-care" | "guests";

export const CHECK_IN_FILTERS: { value: CheckInFilter; label: string }[] = [
  { value: "all", label: "Everyone" },
  { value: "kids", label: "Kids" },
  { value: "in-care", label: "Kids in care" },
  { value: "guests", label: "Guests" },
];

/** "K7RQX" becomes "K7R-QX": easier to read aloud and to match against a tag. */
export function formatPickupCode(code: string): string {
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

export function checkInName(c: Pick<NamedCheckIn, "member" | "guestName">): string {
  return c.member ? `${c.member.firstName} ${c.member.lastName}` : (c.guestName ?? "Guest");
}

export function filterCheckIns<T extends NamedCheckIn>(items: T[], filter: CheckInFilter, search: string): T[] {
  const needle = search.trim().toLowerCase();
  return items.filter((c) => {
    if (filter === "kids" && c.kind !== "CHILD") return false;
    if (filter === "in-care" && (c.kind !== "CHILD" || c.checkedOutAt)) return false;
    if (filter === "guests" && (c.kind !== "ATTENDEE" || c.member)) return false;
    return !needle || checkInName(c).toLowerCase().includes(needle);
  });
}

/** Compares local calendar days, so a service later today still counts as today. */
export function serviceTiming(startsAt: string | Date, now = new Date()): "past" | "today" | "upcoming" {
  const day = dayKey(startsAt);
  const today = dayKey(now);
  if (day === today) return "today";
  return day < today ? "past" : "upcoming";
}

/** Bar heights as whole percents of the largest value. */
export function barPercents(values: number[]): number[] {
  const max = Math.max(0, ...values);
  return values.map((v) => (max === 0 ? 0 : Math.round((v / max) * 100)));
}
