import { describe, expect, it } from "vitest";
import {
  checkInWindow,
  dayHeading,
  placesLeft,
  timeRange,
  groupByDay,
  timeOfDay,
  yearOf,
} from "../../src/lib/format";

describe("church-time formatting", () => {
  it("formats times and day headings in Manila time", () => {
    expect(timeOfDay("2026-11-29T01:00:00Z")).toBe("9:00 AM");
    expect(timeOfDay("2026-11-29T09:30:00Z")).toBe("5:30 PM");
    expect(dayHeading("2026-11-29T01:00:00Z")).toBe("Sunday, Nov 29");
    expect(dayHeading("2026-11-28T17:00:00Z")).toBe("Sunday, Nov 29");
  });

  it("groups items by their church-local day, in order", () => {
    const groups = groupByDay([
      { startsAt: "2026-11-29T09:00:00Z", id: "b" },
      { startsAt: "2026-11-29T01:00:00Z", id: "a" },
      { startsAt: "2026-12-02T11:00:00Z", id: "c" },
    ]);
    expect(groups.map((g) => [g.heading, g.items.map((i) => i.id)])).toEqual([
      ["Sunday, Nov 29", ["a", "b"]],
      ["Wednesday, Dec 2", ["c"]],
    ]);
  });

  it("knows the year", () => {
    expect(yearOf("2026-12-31T17:00:00Z")).toBe(2027);
  });
});

describe("detail screen formatting", () => {
  it("writes a time range in church time, with the day once", () => {
    expect(timeRange("2026-12-20T10:00:00Z", "2026-12-20T12:30:00Z")).toBe(
      "6:00 PM to 8:30 PM",
    );
  });

  it("says where check-in stands for a service", () => {
    const opens = "2026-11-28T22:00:00Z";
    const closes = "2026-11-29T07:00:00Z";
    expect(checkInWindow(opens, closes, new Date("2026-11-28T20:00:00Z"))).toBe(
      "Check-in opens Sunday, Nov 29 at 6:00 AM",
    );
    expect(checkInWindow(opens, closes, new Date("2026-11-29T00:30:00Z"))).toBe(
      "Check-in is open until 3:00 PM",
    );
    expect(checkInWindow(opens, closes, new Date("2026-11-29T08:00:00Z"))).toBe(
      "Check-in has closed",
    );
  });

  it("counts places left, or says it is full", () => {
    expect(placesLeft(300, 4)).toBe("296 places left");
    expect(placesLeft(20, 19)).toBe("1 place left");
    expect(placesLeft(20, 20)).toBe("Full");
    expect(placesLeft(null, 4)).toBeNull();
  });
});
