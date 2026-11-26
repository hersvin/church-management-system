/** Dates in church time (Manila, UTC+8 with no daylight saving), whatever the phone's time zone. */
const OFFSET_MS = 8 * 60 * 60 * 1000;
const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const local = (iso: string) => new Date(Date.parse(iso) + OFFSET_MS);

export function timeOfDay(iso: string): string {
  const d = local(iso);
  const h = d.getUTCHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(d.getUTCMinutes()).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export function dayHeading(iso: string): string {
  const d = local(iso);
  return `${DAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export const shortDate = (iso: string) => {
  const d = local(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
};

export const yearOf = (iso: string) => local(iso).getUTCFullYear();

const dayKey = (iso: string) => local(iso).toISOString().slice(0, 10);

/** Items grouped under church-local day headings, earliest first. */
export function groupByDay<T extends { startsAt: string }>(
  items: readonly T[],
): { heading: string; items: T[] }[] {
  const groups = new Map<string, { heading: string; items: T[] }>();
  for (const item of [...items].sort((a, b) =>
    a.startsAt.localeCompare(b.startsAt),
  )) {
    const key = dayKey(item.startsAt);
    const group = groups.get(key) ?? {
      heading: dayHeading(item.startsAt),
      items: [],
    };
    group.items.push(item);
    groups.set(key, group);
  }
  return [...groups.values()];
}

export const timeRange = (startIso: string, endIso: string) =>
  `${timeOfDay(startIso)} to ${timeOfDay(endIso)}`;

/** Where self check-in stands for a service, in church time. */
export function checkInWindow(
  opensIso: string,
  closesIso: string,
  now = new Date(),
): string {
  if (now.getTime() < Date.parse(opensIso))
    return `Check-in opens ${dayHeading(opensIso)} at ${timeOfDay(opensIso)}`;
  if (now.getTime() <= Date.parse(closesIso))
    return `Check-in is open until ${timeOfDay(closesIso)}`;
  return "Check-in has closed";
}

export function placesLeft(
  capacity: number | null,
  registered: number,
): string | null {
  if (capacity === null) return null;
  const left = capacity - registered;
  if (left <= 0) return "Full";
  return `${left} ${left === 1 ? "place" : "places"} left`;
}
