import {
  keyIndex,
  parseChart,
  transposeChart,
  transposeSemitones,
} from "@cms/shared";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { draftFromPlaylist, setKey, toSavePayload } from "./music";
import {
  useMusicActions,
  useMusicStore,
  usePlaylist,
  useSong,
} from "./music-queries";
import { neighbours } from "./viewer";

/** Common worship-key spellings for each semitone when stepping up or down. */
const PITCHES = [
  "C",
  "C#",
  "D",
  "Eb",
  "E",
  "F",
  "F#",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
];

/**
 * Everything the song viewer and stage share: the song and chart, the playlist row it came from,
 * the playing key (saved in the playlist row when there is one), and the songs before and after it.
 */
export function useSongView(
  params: { songId: string; playlistId?: string; entry?: string },
  screen: "/music/song" | "/music/stage",
) {
  const song = useSong(params.songId);
  const store = useMusicStore();
  const playlist = usePlaylist(params.playlistId ?? null);
  const actions = useMusicActions();
  const draft =
    store.getDraft(params.playlistId ?? null) ??
    (playlist.data ? draftFromPlaylist(playlist.data) : undefined);
  const row = draft?.entries.find((e) => e.key === params.entry);
  const [localKey, setLocalKey] = useState<string | null>(null);

  const originalKey = row?.originalKey ?? song.data?.originalKey ?? null;
  const selectedKey = row ? row.selectedKey : (localKey ?? originalKey);
  const shift = transposeSemitones(originalKey, selectedKey);
  const lines = useMemo(
    () =>
      song.data?.chart
        ? transposeChart(parseChart(song.data.chart), originalKey, selectedKey)
        : [],
    [song.data?.chart, originalKey, selectedKey],
  );

  function chooseKey(key: string | null) {
    if (draft && row) store.setDraft(setKey(draft, row.key, key));
    else setLocalKey(key);
  }

  /** One semitone up or down from the playing key. */
  function step(by: 1 | -1) {
    const index = keyIndex(selectedKey);
    if (index === null) return;
    chooseKey(PITCHES[(index + by + 12) % 12]);
  }

  const dirty = Boolean(draft && store.getDraft(draft.id));
  async function saveKey() {
    if (!draft) return;
    await actions.savePlaylist.mutateAsync({
      id: draft.id,
      body: toSavePayload(draft),
    });
    store.clearDraft(draft.id);
  }

  const place = neighbours(draft?.entries ?? [], params.entry);
  function go(entryKey: string | null) {
    const target = draft?.entries.find((e) => e.key === entryKey);
    if (!target || !draft) return;
    router.setParams({
      songId: target.song.id,
      playlistId: draft.id,
      entry: target.key,
    });
  }

  return {
    song,
    draft,
    row,
    originalKey,
    selectedKey,
    shift,
    lines,
    chooseKey,
    step,
    dirty,
    saveKey,
    saving: actions.savePlaylist.isPending,
    saveError: actions.savePlaylist.error,
    place,
    previous: () => go(place.previous),
    next: () => go(place.next),
    openOther: () =>
      router.replace({
        pathname: screen === "/music/song" ? "/music/stage" : "/music/song",
        params,
      }),
  };
}
