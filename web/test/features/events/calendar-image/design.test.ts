import { describe, expect, it } from "vitest";
import { CATEGORY_COLORS, defaultDesign, PALETTES, posterScale, readableOn, SIZE_GROUPS, SIZES, STYLE_PRESETS, withPalette, withStyle } from "@/features/events/calendar-image/design";

describe("readableOn", () => {
  it("puts white text on dark colors and ink on light ones", () => {
    expect(readableOn("#C2410C")).toBe("#ffffff");
    expect(readableOn("#E8590C")).toBe("#141310");
    expect(readableOn("#E8590C", true)).toBe("#ffffff");
    expect(readableOn("#141310")).toBe("#ffffff");
    expect(readableOn("#FFF4E6")).toBe("#141310");
    expect(readableOn("#ffd43b")).toBe("#141310");
  });
});

it("keeps every colorful chip readable with white text", () => {
  for (const color of Object.values(CATEGORY_COLORS)) expect(readableOn(color), color).toBe("#ffffff");
});

describe("design presets", () => {
  it("starts colorful, as a month grid, with the month as the title", () => {
    const d = defaultDesign({ title: "December", subtitle: "What's on", footer: "Main Campus" });
    expect(d).toMatchObject({ style: "colorful", layout: "grid", size: "square", title: "December", showTimes: true });
    expect(d.colors).toEqual(STYLE_PRESETS.colorful.colors);
  });

  it("switching style resets colors and fonts but keeps the words", () => {
    const d = withStyle(defaultDesign({ title: "Advent", subtitle: "", footer: "" }), "ink");
    expect(d.style).toBe("ink");
    expect(d.colors).toEqual(STYLE_PRESETS.ink.colors);
    expect(d.headingFont).toBe(STYLE_PRESETS.ink.headingFont);
    expect(d.title).toBe("Advent");
  });

  it("a palette changes only the four colors", () => {
    const base = defaultDesign({ title: "T", subtitle: "", footer: "" });
    const d = withPalette(base, "Lagoon");
    expect(d.colors).toEqual(PALETTES.Lagoon);
    expect(d.headingFont).toBe(base.headingFont);
  });
});

describe("sizes", () => {
  it("offers landscape, social, screen, and print sizes, each in exactly one group", () => {
    const grouped = SIZE_GROUPS.flatMap((g) => g.sizes);
    expect(new Set(grouped).size).toBe(grouped.length);
    expect([...grouped].sort()).toEqual(Object.keys(SIZES).sort());
    expect(SIZE_GROUPS.map((g) => g.label)).toEqual(["Social", "Screens", "Print"]);
    for (const s of Object.values(SIZES)) {
      expect(Number.isInteger(s.width) && Number.isInteger(s.height)).toBe(true);
      expect(Math.max(s.width, s.height)).toBeLessThanOrEqual(2400);
    }
    const landscape = Object.values(SIZES).filter((s) => s.width > s.height);
    expect(landscape.length).toBeGreaterThanOrEqual(4);
    expect(SIZES.landscape).toMatchObject({ width: 1920, height: 1080 });
  });

  it("scales the drawing by the shorter side, so wide images keep a short header", () => {
    expect(posterScale(SIZES.square)).toBe(1);
    expect(posterScale(SIZES.story)).toBe(1);
    expect(posterScale(SIZES.landscape)).toBe(1);
    expect(posterScale({ width: 1200, height: 630 })).toBeCloseTo(0.583, 3);
  });
});
