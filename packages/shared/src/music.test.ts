import { describe, expect, it } from "vitest";
import {
  MUSIC_KEYS,
  formatTransposition,
  keyIndex,
  playlistSaveSchema,
  songCreateSchema,
  songListQuerySchema,
  songUpdateSchema,
  transposeSemitones,
} from "./music";

const ID = "11111111-1111-4111-8111-111111111111";

describe("musical keys", () => {
  it("offers the 12 sharp keys and the 5 flat equivalents", () => {
    expect(MUSIC_KEYS).toEqual(["C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"]);
  });

  it("treats flats and their sharp equivalents as the same pitch", () => {
    expect(keyIndex("C")).toBe(0);
    expect(keyIndex("Db")).toBe(keyIndex("C#"));
    expect(keyIndex("Bb")).toBe(10);
    expect(keyIndex("H")).toBeNull();
  });

  it("calculates the transposition the short way round", () => {
    expect(transposeSemitones("D", "E")).toBe(2);
    expect(transposeSemitones("E", "D")).toBe(-2);
    expect(transposeSemitones("G", "E")).toBe(-3);
    expect(transposeSemitones("A", "C")).toBe(3);
    expect(transposeSemitones("C", "F#")).toBe(6);
    expect(transposeSemitones("B", "C")).toBe(1);
    expect(transposeSemitones("C#", "Db")).toBe(0);
    expect(transposeSemitones(null, "E")).toBe(0);
  });

  it("describes the transposition for people", () => {
    expect(formatTransposition(2)).toBe("+2 semitones");
    expect(formatTransposition(-3)).toBe("-3 semitones");
    expect(formatTransposition(1)).toBe("+1 semitone");
    expect(formatTransposition(0)).toBe("Original key");
  });
});

describe("music schemas", () => {
  it("accepts a catalog song with optional metadata missing", () => {
    const song = songCreateSchema.parse({ title: " What a Beautiful Name ", source: "ITUNES", externalId: "1234", originalKey: "D" });
    expect(song.title).toBe("What a Beautiful Name");
    expect(songCreateSchema.safeParse({ title: "x", source: "MANUAL", originalKey: "H" }).success).toBe(false);
    expect(songCreateSchema.safeParse({ title: "x", source: "ITUNES" }).success).toBe(false);
    expect(songCreateSchema.safeParse({ title: "x", source: "MANUAL", bpm: 400 }).success).toBe(false);
    expect(songCreateSchema.safeParse({ title: "x", source: "MANUAL", sourceUrl: "javascript:alert(1)" }).success).toBe(false);
  });

  it("saves a playlist's songs in order with a key per song", () => {
    const saved = playlistSaveSchema.parse({ songs: [{ songId: ID, selectedKey: "E" }, { songId: ID, selectedKey: null, notes: " Reprise " }] });
    expect(saved.songs[1].notes).toBe("Reprise");
    expect(playlistSaveSchema.safeParse({ songs: [{ songId: ID, selectedKey: "Q" }] }).success).toBe(false);
    expect(playlistSaveSchema.safeParse({ songs: Array.from({ length: 101 }, () => ({ songId: ID, selectedKey: null })) }).success).toBe(false);
  });

  it("stores a chord chart on a song, with blank text clearing it", () => {
    expect(songUpdateSchema.parse({ chart: "[D]Word" })).toEqual({ chart: "[D]Word" });
    expect(songUpdateSchema.parse({ chart: "   " })).toEqual({ chart: null });
    expect(songUpdateSchema.safeParse({ chart: "x".repeat(20001) }).success).toBe(false);
  });

  it("accepts a hand-entered song with its chart, and library sort and chart filters", () => {
    expect(songCreateSchema.parse({ title: "Our Song", source: "MANUAL", chart: " [G]Hello " }).chart).toBe("[G]Hello");
    expect(songListQuerySchema.parse({ sort: "artist", hasChart: "true" })).toMatchObject({ sort: "artist", hasChart: true });
    expect(songListQuerySchema.parse({}).sort).toBe("title");
    expect(songListQuerySchema.safeParse({ sort: "random" }).success).toBe(false);
  });
});
