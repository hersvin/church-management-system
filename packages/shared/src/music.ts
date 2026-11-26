import { z } from "zod";
import { nullableText, optionalSearch, optionalText, requiredName } from "./fields";

/** The 12 keys, with the 5 flat spellings next to their sharp equivalents. */
export const MUSIC_KEYS = ["C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"] as const;
export type MusicKey = (typeof MUSIC_KEYS)[number];

const PITCH: Record<MusicKey, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
};

/** Pitch class 0 to 11, or null for anything that is not one of the keys. */
export function keyIndex(key: string | null | undefined): number | null {
  return key && key in PITCH ? PITCH[key as MusicKey] : null;
}

/**
 * Semitones from the original key to the selected key, taking the shorter way round
 * (-5 to +6), which is how worship teams count a key change. Unknown keys mean no change.
 */
export function transposeSemitones(original: string | null | undefined, selected: string | null | undefined): number {
  const from = keyIndex(original);
  const to = keyIndex(selected);
  if (from === null || to === null) return 0;
  const up = (to - from + 12) % 12;
  return up > 6 ? up - 12 : up;
}

export function formatTransposition(semitones: number): string {
  if (semitones === 0) return "Original key";
  const sign = semitones > 0 ? "+" : "-";
  const n = Math.abs(semitones);
  return `${sign}${n} ${n === 1 ? "semitone" : "semitones"}`;
}

export const SONG_SOURCES = ["ITUNES", "MUSICBRAINZ", "MANUAL"] as const;
export type SongSource = (typeof SONG_SOURCES)[number];

const musicKey = z.enum(MUSIC_KEYS);
const httpsUrl = z.url({ protocol: /^https$/ });

/** Adding a song to the church library, from a catalog result or typed in by hand. */
export const songCreateSchema = z
  .object({
    title: requiredName.max(200),
    artist: optionalText(200),
    composer: optionalText(200),
    originalKey: musicKey.optional(),
    bpm: z.coerce.number().int().min(20).max(300).optional(),
    genre: optionalText(80),
    language: optionalText(40),
    source: z.enum(SONG_SOURCES),
    externalId: optionalText(100),
    sourceUrl: httpsUrl.optional(),
    previewUrl: httpsUrl.optional(),
    artworkUrl: httpsUrl.optional(),
    /** Lyrics with chords in square brackets, in the original key; usually added for hand-entered songs. */
    chart: optionalText(20000),
  })
  .strict()
  .refine((s) => s.source === "MANUAL" || Boolean(s.externalId), {
    message: "Catalog songs need the catalog's ID",
    path: ["externalId"],
  });
export type SongCreateInput = z.infer<typeof songCreateSchema>;

/** Correcting library metadata, mostly the key and tempo the catalogs do not provide. */
export const songUpdateSchema = z
  .object({
    originalKey: musicKey.nullable(),
    bpm: z.coerce.number().int().min(20).max(300).nullable(),
    composer: optionalText(200),
    genre: optionalText(80),
    language: optionalText(40),
    /** Lyrics with chords in square brackets (ChordPro style), written in the original key. Blank clears it. */
    chart: nullableText(20000),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });
export type SongUpdateInput = z.infer<typeof songUpdateSchema>;

export const CATALOG_FIELDS = ["any", "title", "artist"] as const;

/** Searching the outside catalogs. Search happens before anything is added to a playlist. */
export const catalogSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
  field: z.enum(CATALOG_FIELDS).default("any"),
  genre: optionalSearch,
});
export type CatalogSearchQuery = z.infer<typeof catalogSearchQuerySchema>;

export const SONG_SORTS = ["title", "artist", "key", "updated"] as const;

/** Searching the church's own library, where key and language are known. */
export const songListQuerySchema = z.object({
  q: optionalSearch,
  genre: optionalSearch,
  language: optionalSearch,
  originalKey: musicKey.optional(),
  sort: z.enum(SONG_SORTS).default("title"),
  /** true: only songs with chords and lyrics; false: only songs still missing them. */
  hasChart: z.stringbool().optional(),
});
export type SongListQuery = z.infer<typeof songListQuerySchema>;

export const playlistCreateSchema = z
  .object({ name: requiredName.max(120), description: optionalText(500) })
  .strict();
export type PlaylistCreateInput = z.infer<typeof playlistCreateSchema>;

export const playlistUpdateSchema = z
  .object({ name: requiredName.max(120), description: optionalText(500) })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });
export type PlaylistUpdateInput = z.infer<typeof playlistUpdateSchema>;

/** Adding one song from search results; a song already in the playlist is refused unless duplicated on purpose. */
export const playlistAddSongSchema = z
  .object({ songId: z.uuid(), selectedKey: musicKey.nullable().optional() })
  .strict();
export type PlaylistAddSongInput = z.infer<typeof playlistAddSongSchema>;

/**
 * Saving the playlist: the whole song list in order, each with its own selected key. The same song may
 * appear twice only when the list says so (the Duplicate action), for example a reprise.
 */
export const playlistSaveSchema = z
  .object({
    name: requiredName.max(120).optional(),
    description: optionalText(500),
    songs: z
      .array(z.object({ songId: z.uuid(), selectedKey: musicKey.nullable(), notes: optionalText(300) }).strict())
      .max(100),
  })
  .strict();
export type PlaylistSaveInput = z.infer<typeof playlistSaveSchema>;

/** One search result from an outside catalog. Missing metadata is null, never guessed. */
export interface CatalogSong {
  source: Exclude<SongSource, "MANUAL">;
  externalId: string;
  title: string;
  artist: string | null;
  composer: string | null;
  genre: string | null;
  album: string | null;
  durationMs: number | null;
  previewUrl: string | null;
  artworkUrl: string | null;
  sourceUrl: string | null;
}
