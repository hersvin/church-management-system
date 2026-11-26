import { describe, expect, it } from "vitest";
import { dayKey, formatTimeRange, fromLocalInput, groupByDay, monthGrid, toLocalInput } from "@/lib/datetime";

// vitest.config.mts pins TZ to Asia/Manila (UTC+8), the church's timezone.

describe("datetime helpers", () => {
  it("round-trips datetime-local values through UTC", () => {
    const iso = fromLocalInput("2026-12-06T08:00");
    expect(iso).toBe("2026-12-06T00:00:00.000Z");
    expect(toLocalInput(iso!)).toBe("2026-12-06T08:00");
  });

  it("returns undefined for an empty input", () => {
    expect(fromLocalInput("")).toBeUndefined();
  });

  it("keys days by local date", () => {
    expect(dayKey("2026-12-05T17:00:00Z")).toBe("2026-12-06");
  });

  it("formats a same-day time range", () => {
    expect(formatTimeRange("2026-12-06T00:00:00Z", "2026-12-06T01:30:00Z")).toBe("8:00 AM to 9:30 AM");
  });

  it("formats a multi-day range with dates", () => {
    expect(formatTimeRange("2026-12-06T00:00:00Z", "2026-12-07T01:00:00Z")).toBe("Dec 6, 8:00 AM to Dec 7, 9:00 AM");
  });

  it("builds a 6-week month grid starting on Sunday", () => {
    const grid = monthGrid(new Date(2026, 11, 15));
    expect(grid).toHaveLength(42);
    expect(dayKey(grid[0].date)).toBe("2026-11-29");
    expect(grid[0].inMonth).toBe(false);
    expect(grid.find((d) => dayKey(d.date) === "2026-12-01")!.inMonth).toBe(true);
    expect(dayKey(grid[41].date)).toBe("2027-01-09");
  });

  it("groups items by local day, sorted by start", () => {
    const groups = groupByDay([
      { id: "b", startsAt: "2026-12-06T03:00:00Z" },
      { id: "a", startsAt: "2026-12-06T00:00:00Z" },
      { id: "c", startsAt: "2026-12-06T17:00:00Z" },
    ]);
    expect(groups.get("2026-12-06")!.map((i) => i.id)).toEqual(["a", "b"]);
    expect(groups.get("2026-12-07")!.map((i) => i.id)).toEqual(["c"]);
  });
});
