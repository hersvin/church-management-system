import type { PublicLanding } from "@cms/shared";
import { describe, expect, it } from "vitest";
import { LANDING } from "@/features/landing/content";
import { mergeLanding, serviceLabel } from "@/features/landing/live";

const live: PublicLanding = {
  church: { name: "Grace Church", tagline: "Belong.", email: "office@grace.test", phone: null },
  campuses: [
    {
      name: "Main Campus",
      address: "100 Grace Avenue",
      services: [
        { name: "Sunday Worship 9 AM", startsAt: "2026-11-29T01:00:00.000Z" },
        { name: "Sunday Worship 5 PM", startsAt: "2026-11-29T09:00:00.000Z" },
        // Same slot next week: listed once.
        { name: "Sunday Worship 9 AM", startsAt: "2026-12-06T01:00:00.000Z" },
      ],
    },
    { name: "North Campus", address: null, services: [{ name: "Friday youth", startsAt: "2026-11-27T10:30:00.000Z" }] },
  ],
  ministries: [
    { name: "Worship Team", category: "WORSHIP", meetingSchedule: "Thursdays 7 PM", branch: "Main Campus" },
    { name: "Media Crew", category: "MEDIA", meetingSchedule: null, branch: "North Campus" },
  ],
  rooms: [
    { name: "Prayer Room", branch: "South", location: "Second floor", capacity: 15, hourlyRate: 300, features: [] },
    { name: "Classroom A", branch: "Main", location: null, capacity: 30, hourlyRate: 500, features: ["TV"] },
    { name: "Fellowship Hall", branch: "Main", location: "Annex", capacity: 150, hourlyRate: 2500, features: ["Kitchen"] },
    { name: "Sanctuary", branch: "Main", location: null, capacity: 400, hourlyRate: 6000, features: ["Piano"] },
  ],
};

describe("serviceLabel", () => {
  it("names the weekday and time in church time", () => {
    expect(serviceLabel("2026-11-29T01:00:00.000Z")).toBe("Sunday 9:00 AM");
    expect(serviceLabel("2026-11-27T10:30:00.000Z")).toBe("Friday 6:30 PM");
  });
});

describe("mergeLanding", () => {
  it("keeps the static content when there is no live data", () => {
    expect(mergeLanding(LANDING, null)).toBe(LANDING);
  });

  it("uses church settings and keeps static values where a setting is empty", () => {
    const merged = mergeLanding(LANDING, live);
    expect(merged.church).toEqual({ name: "Grace Church", email: "office@grace.test", phone: LANDING.church.phone });
  });

  it("lists each campus with its distinct service times in week order", () => {
    const merged = mergeLanding(LANDING, live);
    expect(merged.campuses).toEqual([
      { name: "Main Campus", address: "100 Grace Avenue", services: ["Sunday 9:00 AM", "Sunday 5:00 PM"] },
      { name: "North Campus", address: "", services: ["Friday 6:30 PM"] },
    ]);
  });

  it("writes the hero lede and trust counts from the data", () => {
    const merged = mergeLanding(LANDING, live);
    expect(merged.hero.lede).toBe(
      "Sundays at 9:00 AM and 5:00 PM at Main Campus, 100 Grace Avenue. Kids Church runs during Sunday services, with secure check‑in at the door.",
    );
    expect(merged.hero.trust).toEqual(["Two campuses", "Two ministries to join", LANDING.hero.trust[2]]);
    expect(merged.hero.title).toBe(LANDING.hero.title);
  });

  it("maps ministries to marks and shows the schedule or the campus", () => {
    const merged = mergeLanding(LANDING, live);
    expect(merged.ministries.title).toBe("Two ministries, one family.");
    expect(merged.ministries.items).toEqual([
      { mark: "worship", name: "Worship Team", detail: "Thursdays 7 PM" },
      { mark: "worship", name: "Media Crew", detail: "North Campus" },
    ]);
  });

  it("shows three room plans spread across the price range, with live rates", () => {
    const merged = mergeLanding(LANDING, live);
    expect(merged.rooms.plans.map((p) => [p.name, p.ratePerHour])).toEqual([
      ["Prayer Room", 300],
      ["Fellowship Hall", 2500],
      ["Sanctuary", 6000],
    ]);
    // Known rooms keep their written "best for" text; others fall back to where they are.
    expect(merged.rooms.plans[1].bestFor).toBe("Parties, seminars, community meals");
    expect(merged.rooms.plans[0].bestFor).toBe("Second floor, South");
    expect(merged.rooms.note).toBe("Current rates from the church office. Confirm dates before you book.");
  });

  it("keeps static sections that the data leaves empty", () => {
    const merged = mergeLanding(LANDING, { ...live, campuses: [], ministries: [], rooms: [] });
    expect(merged.campuses).toBe(LANDING.campuses);
    expect(merged.ministries).toBe(LANDING.ministries);
    expect(merged.rooms).toBe(LANDING.rooms);
    expect(merged.hero.lede).toBe(LANDING.hero.lede);
  });
});
