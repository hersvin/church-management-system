import { describe, expect, it } from "vitest";
import {
  FONT_MAX,
  FONT_MIN,
  VIEWER_THEMES,
  clampFont,
  neighbours,
  tapTempo,
} from "../../src/lib/viewer";

describe("song viewer", () => {
  it("finds the songs before and after in the setlist", () => {
    const list = [{ key: "a" }, { key: "b" }, { key: "c" }];
    expect(neighbours(list, "b")).toEqual({
      index: 1,
      count: 3,
      previous: "a",
      next: "c",
    });
    expect(neighbours(list, "a")).toMatchObject({ previous: null, next: "b" });
    expect(neighbours(list, "c")).toMatchObject({ previous: "b", next: null });
    expect(neighbours(list, "z")).toEqual({
      index: -1,
      count: 3,
      previous: null,
      next: null,
    });
  });

  it("keeps the text size within the slider's range", () => {
    expect(clampFont(4)).toBe(FONT_MIN);
    expect(clampFont(99)).toBe(FONT_MAX);
    expect(clampFont(18.6)).toBe(19);
  });

  it("offers paper, sepia, and dark themes with readable ink", () => {
    expect(Object.keys(VIEWER_THEMES)).toEqual(["paper", "sepia", "dark"]);
    for (const theme of Object.values(VIEWER_THEMES))
      expect(theme.ink).not.toBe(theme.paper);
  });

  it("works out the tempo from taps, ignoring a stale first tap", () => {
    expect(tapTempo([0, 500, 1000, 1500])).toBe(120);
    expect(tapTempo([0, 5000, 5600, 6200])).toBe(100);
    expect(tapTempo([0])).toBeNull();
  });
});
