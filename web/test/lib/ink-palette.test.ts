import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The admin app is drawn in ink on paper: states are ink glyphs, and the only hue is the
 * signal red behind `destructive`. This guard fails if a Tailwind hue class creeps back in.
 * The public landing page has its own palette and is not checked.
 */
// This test lives in test/lib; the code it checks is in src.
const ROOT = join(__dirname, "../../src");
const SKIP = [/features[\\/]landing/, /\.test\.tsx?$/];
const HUE = /\b(?:bg|text|border|ring|fill|stroke|from|via|to|outline|decoration|accent|shadow)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate)-\d{2,3}/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe("ink palette", () => {
  it("uses no hue utility classes outside the landing page", () => {
    const offenders = sourceFiles(ROOT)
      .filter((file) => !SKIP.some((re) => re.test(file)))
      .flatMap((file) => (readFileSync(file, "utf8").match(HUE) ?? []).map((cls) => `${relative(ROOT, file)}: ${cls}`));
    expect(offenders).toEqual([]);
  });
});
