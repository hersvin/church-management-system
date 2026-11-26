import { router } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AddSongSheet } from "../../src/components/music/add-song-sheet";
import { PlaylistPanel } from "../../src/components/music/playlist-panel";
import {
  SearchPanel,
  type AddCandidate,
} from "../../src/components/music/search-panel";
import {
  Button,
  Chips,
  Empty,
  ErrorNote,
  Input,
  Loading,
  Txt,
} from "../../src/components/ui";
import { ApiError } from "../../src/lib/api";
import { draftFromPlaylist, isDirty, toSavePayload } from "../../src/lib/music";
import {
  useMusicActions,
  useMusicStore,
  usePlaylist,
  usePlaylists,
} from "../../src/lib/music-queries";
import { colors, space } from "../../src/lib/theme";

/** Side by side from tablet width; on a phone the two panels are switched with tabs. */
const TWO_PANELS = 768;

function NoAccess() {
  return (
    <View style={{ padding: space.lg, gap: space.md }}>
      <Txt variant="title">Music Library</Txt>
      <Empty message="The music library is for the Worship ministry. Ask the church office to add you to Worship if you help prepare the music." />
    </View>
  );
}

function FirstPlaylist() {
  const actions = useMusicActions();
  const store = useMusicStore();
  const [name, setName] = useState("");
  return (
    <View style={{ padding: space.lg, gap: space.md }}>
      <Txt variant="micro">Playlist</Txt>
      <Txt variant="heading">Start a playlist</Txt>
      <Txt variant="small">Name it, then search for songs and press Add.</Txt>
      <Input
        id="first-playlist"
        label="Playlist name"
        value={name}
        onChangeText={setName}
        placeholder="Sunday, December 7"
      />
      {actions.createPlaylist.error ? (
        <ErrorNote message={actions.createPlaylist.error.message} />
      ) : null}
      <Button
        label="Create playlist"
        disabled={!name.trim()}
        busy={actions.createPlaylist.isPending}
        onPress={() =>
          void actions.createPlaylist
            .mutateAsync({ name: name.trim() })
            .then((p) => store.setCurrent(p.id))
        }
      />
    </View>
  );
}

export default function MusicLibrary() {
  const { width } = useWindowDimensions();
  const wide = width >= TWO_PANELS;
  const store = useMusicStore();
  const playlists = usePlaylists();
  const currentId = store.getCurrent() ?? playlists.data?.[0]?.id ?? null;
  const playlist = usePlaylist(currentId);
  const actions = useMusicActions();
  const [tab, setTab] = useState<"search" | "playlist">("search");
  const [candidate, setCandidate] = useState<AddCandidate | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const draft =
    store.getDraft(currentId) ??
    (playlist.data ? draftFromPlaylist(playlist.data) : undefined);
  const dirty = draft ? isDirty(draft, playlist.data) : false;

  async function save() {
    if (!draft) return;
    setSaveError(null);
    try {
      await actions.savePlaylist.mutateAsync({
        id: draft.id,
        body: toSavePayload(draft),
      });
      store.clearDraft(draft.id);
      setNotice("Playlist saved.");
    } catch (e) {
      setSaveError(
        e instanceof Error
          ? e.message
          : "Could not save. Your changes are still here; try again.",
      );
    }
  }

  const forbidden =
    playlists.error instanceof ApiError && playlists.error.status === 403;

  const search = (
    <ScrollView
      contentContainerStyle={{
        padding: space.lg,
        paddingBottom: space.xxl * 2,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <SearchPanel
        onAdd={(c) => {
          setNotice(null);
          setCandidate(c);
        }}
      />
    </ScrollView>
  );

  const panel = playlists.isPending ? (
    <Loading />
  ) : playlists.error ? (
    <View style={{ padding: space.lg }}>
      <ErrorNote message={playlists.error.message} />
    </View>
  ) : !currentId ? (
    <FirstPlaylist />
  ) : playlist.error ? (
    <View style={{ padding: space.lg, gap: space.md }}>
      <ErrorNote message={playlist.error.message} />
      <Button
        label="Choose another playlist"
        variant="outline"
        onPress={() => router.push("/music/playlists")}
      />
    </View>
  ) : !draft ? (
    <Loading />
  ) : (
    <PlaylistPanel
      draft={draft}
      dirty={dirty}
      onChange={(next) => {
        setNotice(null);
        store.setDraft(next);
      }}
      onSave={() => void save()}
      onDiscard={() => store.clearDraft(draft.id)}
      saving={actions.savePlaylist.isPending}
      error={saveError}
      notice={notice}
      onOpenPlaylists={() => router.push("/music/playlists")}
    />
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <View style={styles.top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Txt variant="data">← Back</Txt>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="All songs in the library"
          onPress={() => router.push("/music/songs")}
          hitSlop={12}
        >
          <Txt variant="data">All songs →</Txt>
        </Pressable>
      </View>

      {forbidden ? (
        <NoAccess />
      ) : wide ? (
        <View style={styles.panels}>
          <View style={[styles.panel, styles.divider]}>{search}</View>
          <View style={styles.panel}>{panel}</View>
        </View>
      ) : (
        <>
          <View
            style={{ paddingHorizontal: space.lg, paddingBottom: space.sm }}
          >
            <Chips
              label="Panel"
              value={tab}
              onChange={setTab}
              options={[
                { value: "search", label: "Search songs" },
                {
                  value: "playlist",
                  label: draft
                    ? `Playlist (${draft.entries.length})${dirty ? " ·" : ""}`
                    : "Playlist",
                },
              ]}
            />
            {notice && tab === "search" ? (
              <Txt variant="small" style={{ marginTop: space.xs }}>
                {notice}
              </Txt>
            ) : null}
          </View>
          <View style={{ flex: 1 }}>{tab === "search" ? search : panel}</View>
        </>
      )}

      <AddSongSheet
        candidate={candidate}
        draft={draft}
        onClose={() => setCandidate(null)}
        onAdded={setNotice}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  panels: { flex: 1, flexDirection: "row" },
  panel: { flex: 1 },
  divider: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.hairline,
  },
});
