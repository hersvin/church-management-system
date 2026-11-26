import { describe, expect, it } from "vitest";
import {
  autoScrollSpeed,
  chartSections,
  chordsOverLyricsToChordPro,
  diatonicChords,
  looksLikeChordsOverLyrics,
  parseChart,
  toChordProFile,
  transposeChart,
  transposeChord,
  usesFlats,
} from "./chords";

describe("chord transposition", () => {
  it("moves the root and the bass note, keeping the chord quality", () => {
    expect(transposeChord("D", 2, "E")).toBe("E");
    expect(transposeChord("Bm7", 2, "E")).toBe("C#m7");
    expect(transposeChord("G/B", 2, "E")).toBe("A/C#");
    expect(transposeChord("Asus4", -3, "Bb")).toBe("Gbsus4");
    expect(transposeChord("F#m7b5", 1, "G")).toBe("Gm7b5");
    expect(transposeChord("Cadd9", 0, "C")).toBe("Cadd9");
  });

  it("spells with flats in flat keys and sharps otherwise", () => {
    expect(usesFlats("Bb")).toBe(true);
    expect(usesFlats("F")).toBe(true);
    expect(usesFlats("E")).toBe(false);
    expect(transposeChord("C", 1, "Db")).toBe("Db");
    expect(transposeChord("C", 1, "D")).toBe("C#");
  });

  it("leaves anything that is not a chord alone", () => {
    expect(transposeChord("Chorus", 2, "E")).toBe("Chorus");
    expect(transposeChord("N.C.", 2, "E")).toBe("N.C.");
    expect(transposeChord("x2", 2, "E")).toBe("x2");
  });
});

describe("chart parsing", () => {
  const chart = [
    "{title: What a Beautiful Name}",
    "[Verse 1]",
    "You were the [D]Word at the be[A]ginning",
    "One with [Bm]God the Lord Most [G]High",
    "",
    "{c: Chorus}",
    "[D]What a beautiful [A/C#]name it is",
    "Instrumental [G] [A]",
  ].join("\n");

  it("splits lines into chords over lyrics, with section headings and blank lines", () => {
    const lines = parseChart(chart);
    expect(lines[0]).toEqual({ kind: "section", text: "Verse 1" });
    expect(lines[1]).toEqual({
      kind: "lyric",
      segments: [
        { chord: null, text: "You were the " },
        { chord: "D", text: "Word at the be" },
        { chord: "A", text: "ginning" },
      ],
    });
    expect(lines[3]).toEqual({ kind: "blank" });
    expect(lines[4]).toEqual({ kind: "section", text: "Chorus" });
    expect(lines[6]).toEqual({
      kind: "lyric",
      segments: [
        { chord: null, text: "Instrumental " },
        { chord: "G", text: " " },
        { chord: "A", text: "" },
      ],
    });
  });

  it("drops the title directive, which the screen shows already", () => {
    expect(parseChart("{title: X}\n{t: Y}\nLa").map((l) => l.kind)).toEqual(["lyric"]);
  });

  it("transposes every chord in the chart to the selected key", () => {
    const lines = transposeChart(parseChart(chart), "D", "E");
    const chords = lines.flatMap((l) => (l.kind === "lyric" ? l.segments.map((s) => s.chord).filter(Boolean) : []));
    expect(chords).toEqual(["E", "B", "C#m", "A", "E", "B/D#", "A", "B"]);
    expect(transposeChart(parseChart(chart), null, "E")).toEqual(parseChart(chart));
  });
});

describe("chart tools", () => {
  it("converts chords written above the lyrics into bracketed chords", () => {
    const text = ["Verse 1", "     D               A", "You were the Word at the beginning", "", "G    D", "Hallelujah"].join("\n");
    expect(chordsOverLyricsToChordPro(text)).toBe(
      ["[Verse 1]", "You w[D]ere the Word at [A]the beginning", "", "[G]Halle[D]lujah"].join("\n"),
    );
  });

  it("keeps a chord line with no lyric under it as chords only", () => {
    expect(chordsOverLyricsToChordPro("Intro\nD  A  Bm  G")).toBe("[Intro]\n[D]  [A]  [Bm]  [G]");
  });

  it("leaves text that already has bracketed chords alone", () => {
    const chordpro = "You were the [D]Word";
    expect(looksLikeChordsOverLyrics(chordpro)).toBe(false);
    expect(looksLikeChordsOverLyrics("D   A\nWord at the be")).toBe(true);
  });

  it("splits a chart into sections for stage mode", () => {
    const lines = parseChart("[Verse 1]\nLine one\nLine two\n\n[Chorus]\nSing\n\nTag line");
    const sections = chartSections(lines);
    expect(sections.map((s) => s.title)).toEqual(["Verse 1", "Chorus", null]);
    expect(sections[0].lines).toHaveLength(2);
    expect(sections[2].lines).toHaveLength(1);
  });

  it("suggests the six common chords of a key, spelled for that key", () => {
    expect(diatonicChords("G")).toEqual(["G", "Am", "Bm", "C", "D", "Em"]);
    expect(diatonicChords("Bb")).toEqual(["Bb", "Cm", "Dm", "Eb", "F", "Gm"]);
    expect(diatonicChords(null)).toEqual([]);
  });

  it("exports a song as a ChordPro file with its details", () => {
    expect(toChordProFile({ title: "Way Maker", artist: "Sinach", originalKey: "E", bpm: 68, chart: "[E]Way maker" })).toBe(
      "{title: Way Maker}\n{artist: Sinach}\n{key: E}\n{tempo: 68}\n\n[E]Way maker\n",
    );
  });

  it("scrolls faster for faster songs and larger text, within limits", () => {
    expect(autoScrollSpeed(null, 18)).toBe(autoScrollSpeed(72, 18));
    expect(autoScrollSpeed(140, 18)).toBeGreaterThan(autoScrollSpeed(70, 18));
    expect(autoScrollSpeed(70, 28)).toBeGreaterThan(autoScrollSpeed(70, 14));
    expect(autoScrollSpeed(300, 40)).toBeLessThanOrEqual(80);
    expect(autoScrollSpeed(20, 10)).toBeGreaterThanOrEqual(4);
  });
});
