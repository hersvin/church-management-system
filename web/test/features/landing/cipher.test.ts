import { describe, expect, it } from "vitest";
import { CIPHER_GLYPHS, cipherFrame, resolveTimes } from "@/features/landing/cipher";

describe("cipherFrame", () => {
  const pick = () => "#";

  it("shows real characters before the cursor and glyphs after it", () => {
    expect(cipherFrame("Grace", 2, pick)).toEqual([
      { char: "G", resolved: true },
      { char: "r", resolved: true },
      { char: "#", resolved: false },
      { char: "#", resolved: false },
      { char: "#", resolved: false },
    ]);
  });

  it("never scrambles spaces or punctuation", () => {
    expect(cipherFrame("a b, c.", 0, pick).map((c) => c.char).join("")).toBe("# #, #.");
  });

  it("is fully resolved at the end", () => {
    expect(cipherFrame("Grace", 5, pick).every((c) => c.resolved)).toBe(true);
  });
});

describe("resolveTimes", () => {
  it("resolves characters left to right inside the spread", () => {
    const times = resolveTimes(5, { delay: 100, spread: 800 });
    expect(times[0]).toBe(100);
    expect(times[4]).toBe(900);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("handles a single character", () => {
    expect(resolveTimes(1, { delay: 50, spread: 800 })).toEqual([50]);
  });
});

it("has a glyph set with no spaces", () => {
  expect(CIPHER_GLYPHS).not.toContain(" ");
  expect(CIPHER_GLYPHS.length).toBeGreaterThan(20);
});
