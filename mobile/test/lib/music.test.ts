import { describe, expect, it } from "vitest";
import {
  addEntry,
  draftFromPlaylist,
  duplicateEntry,
  isDirty,
  moveEntry,
  removeEntry,
  resetKey,
  setKey,
  toSavePayload,
  type PlaylistDetail,
} from "../../src/lib/music";

const song = (id: string, title: string, originalKey: string | null) => ({
  id,
  title,
  artist: "Hillsong Worship",
  composer: null,
  originalKey,
  bpm: null,
  genre: null,
  language: null,
  source: "ITUNES" as const,
  sourceUrl: null,
  previewUrl: null,
  artworkUrl: null,
});
const A = song("a", "What a Beautiful Name", "D");
const B = song("b", "Way Maker", "E");

const detail: PlaylistDetail = {
  id: "p1",
  name: "Sunday",
  description: null,
  createdAt: "2026-11-26T00:00:00.000Z",
  updatedAt: "2026-11-26T00:00:00.000Z",
  songs: [
    {
      id: "e1",
      sequence: 1,
      originalKey: "D",
      selectedKey: "E",
      transposeSemitones: 2,
      notes: null,
      song: A,
    },
    {
      id: "e2",
      sequence: 2,
      originalKey: "E",
      selectedKey: "E",
      transposeSemitones: 0,
      notes: null,
      song: B,
    },
  ],
};

describe("playlist draft", () => {
  it("starts from the saved playlist and is not dirty", () => {
    const draft = draftFromPlaylist(detail);
    expect(draft.entries.map((e) => [e.song.title, e.selectedKey])).toEqual([
      ["What a Beautiful Name", "E"],
      ["Way Maker", "E"],
    ]);
    expect(isDirty(draft, detail)).toBe(false);
  });

  it("changes one song's key without touching the others, and resets to the original", () => {
    const draft = draftFromPlaylist(detail);
    const changed = setKey(draft, draft.entries[1].key, "G");
    expect(changed.entries.map((e) => e.selectedKey)).toEqual(["E", "G"]);
    expect(isDirty(changed, detail)).toBe(true);
    expect(
      resetKey(changed, changed.entries[0].key).entries[0].selectedKey,
    ).toBe("D");
  });

  it("reorders, duplicates right below, and removes entries", () => {
    const draft = draftFromPlaylist(detail);
    const moved = moveEntry(draft, 0, 1);
    expect(moved.entries.map((e) => e.song.id)).toEqual(["b", "a"]);
    const doubled = duplicateEntry(moved, moved.entries[0].key);
    expect(doubled.entries.map((e) => e.song.id)).toEqual(["b", "b", "a"]);
    expect(new Set(doubled.entries.map((e) => e.key)).size).toBe(3);
    expect(
      removeEntry(doubled, doubled.entries[0].key).entries.map(
        (e) => e.song.id,
      ),
    ).toEqual(["b", "a"]);
  });

  it("refuses to add a song that is already in the playlist", () => {
    const draft = draftFromPlaylist(detail);
    expect(addEntry(draft, A, "C")).toEqual({ ok: false, reason: "already" });
    const added = addEntry(draft, song("c", "Goodness of God", "Ab"), null);
    expect(added.ok && added.draft.entries.at(-1)).toMatchObject({
      selectedKey: "Ab",
      song: { id: "c" },
    });
  });

  it("builds the save request in the current order", () => {
    const draft = setKey(
      moveEntry(draftFromPlaylist(detail), 1, 0),
      "e1",
      null,
    );
    expect(toSavePayload({ ...draft, name: " Sunday AM " })).toEqual({
      name: "Sunday AM",
      description: undefined,
      songs: [
        { songId: "b", selectedKey: "E", notes: undefined },
        { songId: "a", selectedKey: null, notes: undefined },
      ],
    });
  });
});
