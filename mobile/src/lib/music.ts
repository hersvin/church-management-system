import type {
  CatalogSong,
  MusicKey,
  PlaylistSaveInput,
  SongSource,
} from "@cms/shared";

/** A song in the church library, as the API returns it. */
export interface LibrarySong {
  id: string;
  title: string;
  artist: string | null;
  composer: string | null;
  originalKey: string | null;
  bpm: number | null;
  genre: string | null;
  language: string | null;
  source: SongSource;
  sourceUrl: string | null;
  previewUrl: string | null;
  artworkUrl: string | null;
}

export interface SearchResult extends CatalogSong {
  librarySongId: string | null;
  originalKey: string | null;
}

export interface CatalogResults {
  songs: SearchResult[];
  unavailable: ("ITUNES" | "MUSICBRAINZ")[];
}

export interface PlaylistSummary {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { firstName: string; lastName: string };
  _count: { songs: number };
}

export interface PlaylistDetail {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  songs: {
    id: string;
    sequence: number;
    originalKey: string | null;
    selectedKey: string | null;
    transposeSemitones: number;
    notes: string | null;
    song: LibrarySong;
  }[];
}

/** One row of the playlist being arranged. `key` is stable while dragging, even for a duplicated song. */
export interface DraftEntry {
  key: string;
  song: LibrarySong;
  originalKey: string | null;
  selectedKey: string | null;
  notes: string | null;
}

/** The playlist as the team is arranging it, before Save. */
export interface PlaylistDraft {
  id: string;
  name: string;
  description: string | null;
  entries: DraftEntry[];
}

let counter = 0;
const nextKey = (prefix: string) => `${prefix}-${++counter}`;

export function draftFromPlaylist(p: PlaylistDetail): PlaylistDraft {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    entries: p.songs.map((s) => ({
      key: s.id,
      song: s.song,
      originalKey: s.originalKey,
      selectedKey: s.selectedKey,
      notes: s.notes,
    })),
  };
}

const update = (
  draft: PlaylistDraft,
  key: string,
  change: (e: DraftEntry) => DraftEntry,
): PlaylistDraft => ({
  ...draft,
  entries: draft.entries.map((e) => (e.key === key ? change(e) : e)),
});

export const setKey = (
  draft: PlaylistDraft,
  key: string,
  selectedKey: string | null,
) => update(draft, key, (e) => ({ ...e, selectedKey }));

export const resetKey = (draft: PlaylistDraft, key: string) =>
  update(draft, key, (e) => ({ ...e, selectedKey: e.originalKey }));

export const setNotes = (
  draft: PlaylistDraft,
  key: string,
  notes: string | null,
) => update(draft, key, (e) => ({ ...e, notes }));

export function moveEntry(
  draft: PlaylistDraft,
  from: number,
  to: number,
): PlaylistDraft {
  const entries = [...draft.entries];
  const [item] = entries.splice(from, 1);
  if (!item) return draft;
  entries.splice(to, 0, item);
  return { ...draft, entries };
}

export const removeEntry = (
  draft: PlaylistDraft,
  key: string,
): PlaylistDraft => ({
  ...draft,
  entries: draft.entries.filter((e) => e.key !== key),
});

/** A second copy of the song right below it, for example a reprise, with the same key. */
export function duplicateEntry(
  draft: PlaylistDraft,
  key: string,
): PlaylistDraft {
  const index = draft.entries.findIndex((e) => e.key === key);
  if (index < 0) return draft;
  const entries = [...draft.entries];
  entries.splice(index + 1, 0, { ...entries[index], key: nextKey("copy") });
  return { ...draft, entries };
}

/** Adding from search: a song already in the playlist is refused (Duplicate is the deliberate way to repeat one). */
export function addEntry(
  draft: PlaylistDraft,
  song: LibrarySong,
  selectedKey: string | null,
): { ok: true; draft: PlaylistDraft } | { ok: false; reason: "already" } {
  if (draft.entries.some((e) => e.song.id === song.id))
    return { ok: false, reason: "already" };
  const entry: DraftEntry = {
    key: nextKey("new"),
    song,
    originalKey: song.originalKey,
    selectedKey: selectedKey ?? song.originalKey,
    notes: null,
  };
  return { ok: true, draft: { ...draft, entries: [...draft.entries, entry] } };
}

export function toSavePayload(draft: PlaylistDraft): PlaylistSaveInput {
  return {
    name: draft.name.trim(),
    description: draft.description?.trim() || undefined,
    songs: draft.entries.map((e) => ({
      songId: e.song.id,
      selectedKey: e.selectedKey as MusicKey | null,
      notes: e.notes?.trim() || undefined,
    })),
  };
}

/** True when the draft differs from what is saved: details, order, keys, or notes. */
export function isDirty(
  draft: PlaylistDraft,
  saved: PlaylistDetail | undefined,
): boolean {
  if (!saved) return false;
  const was = draftFromPlaylist(saved);
  const shape = (d: PlaylistDraft) =>
    JSON.stringify([
      d.name.trim(),
      d.description?.trim() || null,
      d.entries.map((e) => [e.song.id, e.selectedKey, e.notes?.trim() || null]),
    ]);
  return shape(draft) !== shape(was);
}
