import { CHURCH_UTC_OFFSET_MINUTES, type MinistryCategory, type PublicLanding } from "@cms/shared";
import type { LANDING, MinistryMark, RoomPlan } from "./content";

export type LandingContent = typeof LANDING;

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];

const MARK: Record<MinistryCategory, MinistryMark> = {
  WORSHIP: "worship",
  MEDIA: "worship",
  CHILDREN: "kids",
  YOUTH: "youth",
  ADULTS: "youth",
  OUTREACH: "outreach",
  PRAYER: "prayer",
  HOSPITALITY: "hospitality",
  OTHER: "hospitality",
};

const count = (n: number, one: string, many: string) => `${WORDS[n] ?? n} ${n === 1 ? one : many}`;

/** Church local time of a service start. */
function localParts(iso: string) {
  const local = new Date(Date.parse(iso) + CHURCH_UTC_OFFSET_MINUTES * 60 * 1000);
  return { day: local.getUTCDay(), minutes: local.getUTCHours() * 60 + local.getUTCMinutes() };
}

const clock = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = String(minutes % 60).padStart(2, "0");
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? "AM" : "PM"}`;
};

/** "Sunday 9:00 AM" in church time. */
export function serviceLabel(iso: string): string {
  const { day, minutes } = localParts(iso);
  return `${DAYS[day]} ${clock(minutes)}`;
}

/** Distinct weekly slots, Sunday first, then by time. */
function weeklySlots(services: { startsAt: string }[]) {
  const slots = new Map<string, { day: number; minutes: number }>();
  for (const s of services) slots.set(serviceLabel(s.startsAt), localParts(s.startsAt));
  return [...slots.entries()].sort(([, a], [, b]) => a.day - b.day || a.minutes - b.minutes);
}

const andList = (items: string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);

/** Lowest, middle, and highest rate, so the three plans span the price range. */
function spread<T extends { hourlyRate: number }>(rooms: T[]): T[] {
  const sorted = [...rooms].sort((a, b) => a.hourlyRate - b.hourlyRate);
  if (sorted.length <= 3) return sorted;
  return [sorted[0], sorted[Math.round((sorted.length - 1) / 2)], sorted[sorted.length - 1]];
}

/**
 * Landing content with live church data laid over the written copy. Any section the
 * data leaves empty keeps its static text, so the page never renders a blank section.
 */
export function mergeLanding(base: LandingContent, live: PublicLanding | null): LandingContent {
  if (!live) return base;
  const campuses = live.campuses.filter((c) => c.services.length > 0);
  const main = campuses[0];

  const church = {
    ...base.church,
    name: live.church.name ?? base.church.name,
    email: live.church.email ?? base.church.email,
    phone: live.church.phone ?? base.church.phone,
  };

  let lede: string = base.hero.lede;
  if (main) {
    const slots = weeklySlots(main.services);
    const allSunday = slots.every(([, s]) => s.day === 0);
    const where = main.address ? `${main.name}, ${main.address}` : main.name;
    lede = allSunday
      ? `Sundays at ${andList(slots.map(([, s]) => clock(s.minutes)))} at ${where}.`
      : `This week: ${andList(slots.map(([label]) => label))} at ${where}.`;
    lede += " Kids Church runs during Sunday services, with secure check‑in at the door.";
  }

  const ministries =
    live.ministries.length === 0
      ? base.ministries
      : {
          ...base.ministries,
          title: `${count(live.ministries.length, "ministry", "ministries")}, one family.`,
          items: live.ministries.map((m) => ({ mark: MARK[m.category], name: m.name, detail: m.meetingSchedule ?? m.branch })),
        };

  const writtenFor = new Map<string, string>(base.rooms.plans.map((p) => [p.name, p.bestFor]));
  const rooms =
    live.rooms.length === 0
      ? base.rooms
      : {
          ...base.rooms,
          note: "Current rates from the church office. Confirm dates before you book.",
          plans: spread(live.rooms).map(
            (r): RoomPlan => ({
              name: r.name,
              capacity: r.capacity ?? 0,
              ratePerHour: r.hourlyRate,
              bestFor: writtenFor.get(r.name) ?? [r.location, r.branch].filter(Boolean).join(", "),
              includes: r.features,
            }),
          ),
        };

  return {
    ...base,
    church,
    hero: {
      ...base.hero,
      lede,
      trust: [
        campuses.length > 0 ? count(live.campuses.length, "campus", "campuses") : base.hero.trust[0],
        live.ministries.length > 0 ? `${count(live.ministries.length, "ministry", "ministries")} to join` : base.hero.trust[1],
        ...base.hero.trust.slice(2),
      ],
    },
    campuses:
      campuses.length === 0
        ? base.campuses
        : campuses.map((c) => ({ name: c.name, address: c.address ?? "", services: weeklySlots(c.services).map(([label]) => label) })),
    ministries,
    rooms,
  };
}
