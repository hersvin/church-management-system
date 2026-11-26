import { keyIndex, transposeSemitones } from "./music";

const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
/** Keys written with flats; every other key is written with sharps. */
const FLAT_KEYS = new Set(["F", "Bb", "Eb", "Ab", "Db", "Gb"]);

/** A chord: root, optional quality (m7, sus4, add9, maj7, m7b5 ...), optional bass note after a slash. */
const CHORD = /^([A-G](?:#|b)?)((?:maj|min|dim|aug|sus|add|m|M|\d|b|#|\+|-|°|ø|\(|\))*)(?:\/([A-G](?:#|b)?))?$/;

export const usesFlats = (key: string | null | undefined) => Boolean(key && FLAT_KEYS.has(key));

export const isChord = (text: string) => CHORD.test(text.trim());

function moveNote(note: string, semitones: number, flats: boolean): string {
  const index = keyIndex(note);
  if (index === null) return note;
  const next = (((index + semitones) % 12) + 12) % 12;
  return (flats ? FLAT_NAMES : SHARP_NAMES)[next];
}

/** Moves a chord by a number of semitones, spelled for the target key. Text that is not a chord is returned as it is. */
export function transposeChord(chord: string, semitones: number, targetKey: string | null | undefined): string {
  const match = CHORD.exec(chord.trim());
  if (!match || semitones === 0) return chord;
  const [, root, quality, bass] = match;
  const flats = usesFlats(targetKey);
  return `${moveNote(root, semitones, flats)}${quality}${bass ? `/${moveNote(bass, semitones, flats)}` : ""}`;
}

export interface ChartSegment {
  /** The chord played where this piece of lyric starts, or null for lyric before the first chord. */
  chord: string | null;
  text: string;
}

export type ChartLine = { kind: "lyric"; segments: ChartSegment[] } | { kind: "section"; text: string } | { kind: "blank" };

const DIRECTIVE = /^\{\s*([a-z_]+)\s*(?::\s*(.*?))?\s*\}$/i;
const SECTION_DIRECTIVES: Record<string, string | null> = {
  c: null,
  comment: null,
  soc: "Chorus",
  start_of_chorus: "Chorus",
  sov: "Verse",
  start_of_verse: "Verse",
  sob: "Bridge",
  start_of_bridge: "Bridge",
};

/**
 * Reads a chart in ChordPro style: chords in square brackets inside the lyric ("You were the [D]Word"),
 * a line holding only a bracketed label that is not a chord ("[Verse 1]") as a section heading, and the
 * common directives ({c: Chorus}, {soc}). Title and other directives are skipped.
 */
export function parseChart(chart: string): ChartLine[] {
  const lines: ChartLine[] = [];
  for (const raw of chart.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) {
      if (lines.length && lines[lines.length - 1].kind !== "blank") lines.push({ kind: "blank" });
      continue;
    }
    const directive = DIRECTIVE.exec(line.trim());
    if (directive) {
      const name = directive[1].toLowerCase();
      if (name in SECTION_DIRECTIVES) {
        const text = SECTION_DIRECTIVES[name] ?? directive[2] ?? "";
        if (text) lines.push({ kind: "section", text });
      }
      continue;
    }
    const label = /^\[([^\]]+)\]$/.exec(line.trim());
    if (label && !isChord(label[1])) {
      lines.push({ kind: "section", text: label[1].trim() });
      continue;
    }
    const segments: ChartSegment[] = [];
    let chord: string | null = null;
    let text = "";
    for (const part of line.split(/(\[[^\]]*\])/)) {
      const bracket = /^\[([^\]]*)\]$/.exec(part);
      if (bracket) {
        if (chord !== null || text) segments.push({ chord, text });
        chord = bracket[1].trim();
        text = "";
      } else {
        text += part;
      }
    }
    if (chord !== null || text) segments.push({ chord, text });
    lines.push({ kind: "lyric", segments });
  }
  while (lines.length && lines[lines.length - 1].kind === "blank") lines.pop();
  return lines;
}

/** The whole chart moved from the song's original key to the selected key. Without both keys nothing moves. */
export function transposeChart(lines: ChartLine[], originalKey: string | null | undefined, selectedKey: string | null | undefined): ChartLine[] {
  const shift = transposeSemitones(originalKey, selectedKey);
  if (!originalKey || !selectedKey || shift === 0) return lines;
  return lines.map((line) =>
    line.kind === "lyric"
      ? { kind: "lyric", segments: line.segments.map((s) => ({ ...s, chord: s.chord === null ? null : transposeChord(s.chord, shift, selectedKey) })) }
      : line,
  );
}

const SECTION_WORD = /^(verse|chorus|pre-?chorus|bridge|intro|outro|tag|ending|interlude|instrumental|refrain|coda|vamp)\b[\s\d:.x()]*$/i;

const chordTokens = (line: string) => line.trim().split(/\s+/).filter(Boolean);

/** A line made only of chords (and bar marks), as in charts copied from chord websites or songbooks. */
const isChordLine = (line: string) => {
  const tokens = chordTokens(line).filter((t) => t !== "|" && t !== "/");
  return tokens.length > 0 && tokens.every((t) => isChord(t.replace(/^\(|\)$/g, "")));
};

/** True when text is written with chords on their own line above the lyrics, rather than in brackets. */
export function looksLikeChordsOverLyrics(text: string): boolean {
  if (/\[[A-G][^\]]*\]/.test(text)) return false;
  return text.split(/\r?\n/).some((line) => line.trim() && isChordLine(line));
}

function placeChords(chordLine: string, lyric: string): string {
  const marks: { at: number; chord: string }[] = [];
  for (const match of chordLine.matchAll(/\S+/g)) {
    if (isChord(match[0])) marks.push({ at: match.index ?? 0, chord: match[0] });
  }
  let out = lyric.padEnd(Math.max(lyric.length, (marks.at(-1)?.at ?? 0) + 1), " ");
  for (const mark of [...marks].reverse()) out = `${out.slice(0, mark.at)}[${mark.chord}]${out.slice(mark.at)}`;
  return out.replace(/\s+$/, "");
}

/**
 * Turns the common "chords above the lyrics" layout into bracketed chords, keeping each chord at the
 * column where it was written. A chord line with no lyric under it stays as chords; section names
 * such as "Verse 1" or "Chorus" become [Verse 1] headings.
 */
export function chordsOverLyricsToChordPro(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].replace(/\s+$/, "");
    const next = lines[i + 1];
    if (!line.trim()) {
      out.push("");
    } else if (SECTION_WORD.test(line.trim())) {
      out.push(`[${line.trim().replace(/:$/, "")}]`);
    } else if (isChordLine(line)) {
      if (next !== undefined && next.trim() && !isChordLine(next) && !SECTION_WORD.test(next.trim())) {
        out.push(placeChords(line, next.replace(/\s+$/, "")));
        i += 1;
      } else {
        out.push(line.replace(/\S+/g, (t) => (isChord(t) ? `[${t}]` : t)));
      }
    } else {
      out.push(line);
    }
  }
  return out.join("\n");
}

export interface ChartSection {
  title: string | null;
  lines: ChartLine[];
}

/** Sections for stage mode: a heading starts one, and so does lyric after a blank line. */
export function chartSections(lines: ChartLine[]): ChartSection[] {
  const sections: ChartSection[] = [];
  let current: ChartSection | null = null;
  let afterBlank = false;
  for (const line of lines) {
    if (line.kind === "blank") {
      afterBlank = true;
      continue;
    }
    if (line.kind === "section") {
      current = { title: line.text, lines: [] };
      sections.push(current);
    } else {
      if (!current || (afterBlank && current.lines.length > 0)) {
        current = { title: null, lines: [] };
        sections.push(current);
      }
      current.lines.push(line);
    }
    afterBlank = false;
  }
  return sections.filter((s) => s.lines.length > 0 || s.title);
}

/** The six chords most songs in a major key use (I ii iii IV V vi), spelled for the key; they feed the editor's chord bar. */
export function diatonicChords(key: string | null | undefined): string[] {
  const root = keyIndex(key);
  if (root === null) return [];
  const names = usesFlats(key) ? FLAT_NAMES : SHARP_NAMES;
  const steps: [number, string][] = [
    [0, ""],
    [2, "m"],
    [4, "m"],
    [5, ""],
    [7, ""],
    [9, "m"],
  ];
  return steps.map(([step, quality]) => `${names[(root + step) % 12]}${quality}`);
}

/** A song as a ChordPro file for sharing with other apps. */
export function toChordProFile(song: { title: string; artist?: string | null; originalKey?: string | null; bpm?: number | null; chart: string }): string {
  const head = [
    `{title: ${song.title}}`,
    song.artist ? `{artist: ${song.artist}}` : null,
    song.originalKey ? `{key: ${song.originalKey}}` : null,
    song.bpm ? `{tempo: ${song.bpm}}` : null,
  ].filter(Boolean);
  return `${head.join("\n")}\n\n${song.chart.trim()}\n`;
}

/**
 * Auto-scroll speed in screen points per second. Faster songs and larger text scroll faster; a song
 * without a tempo scrolls as if at 72 BPM. People nudge it with the speed buttons from there.
 */
export function autoScrollSpeed(bpm: number | null | undefined, fontSize: number): number {
  const raw = ((bpm ?? 72) / 72) * fontSize * 0.9;
  return Math.round(Math.min(80, Math.max(4, raw)) * 10) / 10;
}
