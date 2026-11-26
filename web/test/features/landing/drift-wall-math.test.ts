import { describe, expect, it } from "vitest";
import { columnVelocity, copiesFor, splitColumns, wrapOffset } from "@/features/landing/drift-wall-math";

describe("splitColumns", () => {
  it("deals items across columns in turn", () => {
    expect(splitColumns(["a", "b", "c", "d", "e"], 3)).toEqual([["a", "d"], ["b", "e"], ["c"]]);
  });

  it("repeats items so no column is empty when there are fewer items than columns", () => {
    expect(splitColumns(["a", "b"], 4)).toEqual([["a"], ["b"], ["a"], ["b"]]);
  });

  it("returns empty columns for no items", () => {
    expect(splitColumns([], 2)).toEqual([[], []]);
  });
});

describe("copiesFor", () => {
  it("stacks enough copies to cover 1.6 times the container, plus one, and never fewer than two", () => {
    // 2 tiles of 100 = 200 per copy; 600 * 1.6 = 960 -> 5 copies, plus one.
    expect(copiesFor(2, 100, 600)).toBe(6);
    expect(copiesFor(20, 100, 100)).toBe(2);
  });
});

describe("wrapOffset", () => {
  it("keeps the offset inside one copy, for either direction", () => {
    expect(wrapOffset(250, 200)).toBe(50);
    expect(wrapOffset(-50, 200)).toBe(150);
    expect(wrapOffset(0, 200)).toBe(0);
  });
});

describe("columnVelocity", () => {
  it("alternates direction by column and varies speed within the variance", () => {
    const v = [0, 1, 2, 3].map((c) => columnVelocity(c, { speed: 40, direction: "up", variance: 0.5 }));
    expect(v[0]).toBeGreaterThan(0);
    expect(v[1]).toBeLessThan(0);
    expect(v[2]).toBeGreaterThan(0);
    for (const x of v) {
      expect(Math.abs(x)).toBeGreaterThanOrEqual(20);
      expect(Math.abs(x)).toBeLessThanOrEqual(60);
    }
  });

  it("flips every column for the down direction", () => {
    const up = columnVelocity(1, { speed: 40, direction: "up", variance: 0.3 });
    expect(columnVelocity(1, { speed: 40, direction: "down", variance: 0.3 })).toBe(-up);
  });

  it("moves every column at the base speed with no variance", () => {
    expect(Math.abs(columnVelocity(3, { speed: 30, direction: "up", variance: 0 }))).toBe(30);
  });
});
