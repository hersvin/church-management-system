import { MUSIC_KEYS, type MusicKey } from "@cms/shared";
import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import {
  addEntry,
  type LibrarySong,
  type PlaylistDraft,
} from "../../lib/music";
import {
  useMusicActions,
  useMusicStore,
  usePlaylists,
} from "../../lib/music-queries";
import { useSession } from "../../lib/session";
import { colors, radius, space } from "../../lib/theme";
import { Button, Chips, ErrorNote, Input, Loading, Txt } from "../ui";
import type { AddCandidate } from "./search-panel";

const NEW = "__new__";

/**
 * Add a search result to a playlist without leaving search: set the original key (catalogs do not give one),
 * pick the playlist or name a new one. The open playlist gets the song in its unsaved arrangement;
 * any other playlist is updated on the server straight away.
 */
export function AddSongSheet({
  candidate,
  draft,
  onClose,
  onAdded,
}: {
  candidate: AddCandidate | null;
  draft: PlaylistDraft | undefined;
  onClose: () => void;
  onAdded: (message: string) => void;
}) {
  const { api } = useSession();
  const store = useMusicStore();
  const playlists = usePlaylists();
  const actions = useMusicActions();
  const [key, setKey] = useState<string>("");
  const [target, setTarget] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const title = candidate
    ? candidate.kind === "catalog"
      ? candidate.result.title
      : candidate.song.title
    : "";
  const knownKey = candidate
    ? candidate.kind === "catalog"
      ? candidate.result.originalKey
      : candidate.song.originalKey
    : null;

  useEffect(() => {
    if (!candidate) return;
    setKey(knownKey ?? "");
    setTarget(store.getCurrent() ?? playlists.data?.[0]?.id ?? NEW);
    setNewName("");
    setError(null);
    // Reset only when a new song is chosen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate]);

  async function librarySong(): Promise<LibrarySong> {
    if (!candidate) throw new Error("No song chosen");
    const originalKey = (key || undefined) as MusicKey | undefined;
    if (candidate.kind === "library") {
      if (!candidate.song.originalKey && originalKey) {
        return api.request<LibrarySong>(`/music/songs/${candidate.song.id}`, {
          method: "PATCH",
          json: { originalKey },
        });
      }
      return candidate.song;
    }
    const r = candidate.result;
    return actions.addSong.mutateAsync({
      title: r.title,
      artist: r.artist ?? undefined,
      genre: r.genre ?? undefined,
      source: r.source,
      externalId: r.externalId,
      sourceUrl: r.sourceUrl ?? undefined,
      previewUrl: r.previewUrl ?? undefined,
      artworkUrl: r.artworkUrl ?? undefined,
      originalKey,
    });
  }

  async function add() {
    setError(null);
    if (target === NEW && !newName.trim())
      return setError("Name the new playlist.");
    setBusy(true);
    try {
      const song = await librarySong();
      if (target === NEW) {
        const created = await actions.createPlaylist.mutateAsync({
          name: newName.trim(),
        });
        await actions.addToPlaylist.mutateAsync({
          id: created.id,
          songId: song.id,
          selectedKey: song.originalKey,
        });
        store.setCurrent(created.id);
        onAdded(`Added to ${created.name}`);
      } else if (draft && target === draft.id) {
        const result = addEntry(draft, song, song.originalKey);
        if (!result.ok) {
          setBusy(false);
          return setError(
            "This song is already in the playlist. Use Duplicate on it to sing it twice.",
          );
        }
        store.setDraft(result.draft);
        onAdded(`Added to ${draft.name}. Save the playlist to keep it.`);
      } else {
        await actions.addToPlaylist.mutateAsync({
          id: target,
          songId: song.id,
          selectedKey: song.originalKey,
        });
        onAdded(
          `Added to ${playlists.data?.find((p) => p.id === target)?.name ?? "the playlist"}`,
        );
      }
      onClose();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not add the song. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  const options = [
    ...(playlists.data ?? []).map((p) => ({
      value: p.id,
      label: p.id === draft?.id ? `${p.name} (open)` : p.name,
    })),
    { value: NEW, label: "New playlist" },
  ];

  return (
    <Modal
      visible={Boolean(candidate)}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityLabel="Close"
      >
        <Pressable
          style={styles.sheet}
          onPress={() => {}}
          accessibilityViewIsModal
        >
          <ScrollView
            contentContainerStyle={{ gap: space.md }}
            keyboardShouldPersistTaps="handled"
          >
            <Txt variant="micro">Add to playlist</Txt>
            <Txt variant="heading">{title}</Txt>

            <View style={{ gap: space.xs }}>
              <Txt variant="micro">Original key</Txt>
              {knownKey ? (
                <Txt variant="data">{knownKey} (from the library)</Txt>
              ) : (
                <>
                  <Txt variant="small">
                    The catalog does not say the key. Choose it if you know it;
                    you can change the playing key later.
                  </Txt>
                  <Chips
                    label="Original key"
                    value={key}
                    onChange={setKey}
                    options={[
                      { value: "", label: "Not known" },
                      ...MUSIC_KEYS.map((k) => ({
                        value: k as string,
                        label: k,
                      })),
                    ]}
                  />
                </>
              )}
            </View>

            <View style={{ gap: space.xs }}>
              <Txt variant="micro">Playlist</Txt>
              {playlists.isPending ? <Loading /> : null}
              {playlists.error ? (
                <ErrorNote message={playlists.error.message} />
              ) : null}
              <Chips
                label="Playlist"
                value={target}
                onChange={setTarget}
                options={options}
              />
            </View>
            {target === NEW ? (
              <Input
                id="new-playlist"
                label="New playlist name"
                value={newName}
                onChangeText={setNewName}
                placeholder="Sunday, December 7"
              />
            ) : null}

            {error ? <ErrorNote message={error} /> : null}
            <Button label="Add song" onPress={() => void add()} busy={busy} />
            <Button
              label="Cancel"
              variant="outline"
              onPress={onClose}
              disabled={busy}
            />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(20, 19, 16, 0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "88%",
    backgroundColor: colors.paper,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: colors.ink,
    padding: space.xl,
    paddingBottom: space.xxl,
    maxWidth: 640,
    width: "100%",
    alignSelf: "center",
  },
});
