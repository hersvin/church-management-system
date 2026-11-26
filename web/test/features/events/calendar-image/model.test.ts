import { describe, expect, it } from "vitest";
import { buildPoster, gridGeometry, monthLabel, timeLabel, type PosterEvent } from "@/features/events/calendar-image/model";

const at = (day: number, h: number, m = 0) => new Date(2026, 11, day, h, m).toISOString();
const ev = (id: string, day: number, h: number, extra: Partial<PosterEvent> = {}): PosterEvent => ({
  id,
  title: `Event ${id}`,
  category: "SERVICE",
  status: "SCHEDULED",
  startsAt: at(day, h),
  endsAt: at(day, h + 1),
  branchId: "main",
  room: null,
  ...extra,
});

describe("buildPoster", () => {
  it("lays December 2026 out in Sunday-first weeks", () => {
    const poster = buildPoster({ month: "2026-12", events: [], weekStart: 0 });
    expect(poster.weeks).toHaveLength(5);
    expect(poster.weeks[0].map((d) => d.day)).toEqual([29, 30, 1, 2, 3, 4, 5]);
    expect(poster.weeks[0][0].inMonth).toBe(false);
    expect(poster.weeks[4].at(-1)).toMatchObject({ day: 2, inMonth: false });
  });

  it("can start weeks on Monday", () => {
    const poster = buildPoster({ month: "2026-12", events: [], weekStart: 1 });
    expect(poster.weeks[0].map((d) => d.day)).toEqual([30, 1, 2, 3, 4, 5, 6]);
    expect(poster.weekdays[0]).toBe("Mon");
  });

  it("puts events on their day in time order, skipping cancelled events and other branches", () => {
    const poster = buildPoster({
      month: "2026-12",
      weekStart: 0,
      branchId: "main",
      events: [
        ev("late", 6, 17),
        ev("early", 6, 9),
        ev("cancelled", 6, 12, { status: "CANCELLED" }),
        ev("north", 6, 10, { branchId: "north" }),
        ev("november", 30, 9, { startsAt: new Date(2026, 10, 30, 9).toISOString() }),
      ],
    });
    const sunday6 = poster.weeks[1][0];
    expect(sunday6.day).toBe(6);
    expect(sunday6.entries.map((e) => e.id)).toEqual(["early", "late"]);
    expect(poster.list.map((e) => e.id)).toEqual(["early", "late"]);
  });

  it("applies renames and hides from the editor", () => {
    const poster = buildPoster({
      month: "2026-12",
      weekStart: 0,
      events: [ev("a", 12, 8), ev("b", 12, 10)],
      edits: { a: { title: "Food drive" }, b: { hidden: true } },
    });
    expect(poster.list.map((e) => e.title)).toEqual(["Food drive"]);
  });

  it("gives each list entry a short date label", () => {
    const poster = buildPoster({ month: "2026-12", weekStart: 0, events: [ev("a", 24, 18, { room: "Sanctuary" })] });
    expect(poster.list[0]).toMatchObject({ dateLabel: "THU 24", time: "6:00 PM", room: "Sanctuary" });
  });
});

describe("labels", () => {
  it("formats times and months", () => {
    expect(timeLabel(at(6, 9))).toBe("9:00 AM");
    expect(timeLabel(at(6, 18, 30))).toBe("6:30 PM");
    expect(monthLabel("2026-12")).toEqual({ month: "December", year: "2026" });
  });
});

describe("gridGeometry", () => {
  it("splits the area into equal columns and rows inside the padding", () => {
    const g = gridGeometry({ x: 40, y: 200, width: 690, height: 500 }, 5, 10);
    expect(g.cellWidth).toBe(90);
    expect(g.cellHeight).toBe(92);
    expect(g.cell(0, 0)).toEqual({ x: 40, y: 200, width: 90, height: 92 });
    expect(g.cell(4, 6)).toEqual({ x: 40 + 6 * 100, y: 200 + 4 * 102, width: 90, height: 92 });
  });

  it("finds the cell under a point, or null in a gap or outside", () => {
    const g = gridGeometry({ x: 0, y: 0, width: 690, height: 500 }, 5, 10);
    expect(g.hit(5, 5)).toEqual({ row: 0, col: 0 });
    expect(g.hit(105, 210)).toEqual({ row: 2, col: 1 });
    expect(g.hit(95, 5)).toBeNull();
    expect(g.hit(800, 5)).toBeNull();
  });
});
