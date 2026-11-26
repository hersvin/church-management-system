import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import {
  Button,
  ConfirmModal,
  Empty,
  ErrorNote,
  Icon,
  Input,
  Loading,
  Screen,
  Txt,
} from "../../src/components/ui";
import { shortDate } from "../../src/lib/format";
import type { PlaylistSummary } from "../../src/lib/music";
import {
  useMusicActions,
  useMusicStore,
  usePlaylists,
} from "../../src/lib/music-queries";
import { colors, radius, space } from "../../src/lib/theme";

/** Every saved playlist: open one to arrange it, duplicate it as a starting point, or delete it. */
export default function MyPlaylists() {
  const playlists = usePlaylists();
  const actions = useMusicActions();
  const store = useMusicStore();
  const [name, setName] = useState("");
  const [deleting, setDeleting] = useState<PlaylistSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  function open(id: string) {
    store.setCurrent(id);
    router.back();
  }

  async function run(work: () => Promise<unknown>) {
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "That did not work. Try again.",
      );
    }
  }

  return (
    <Screen
      refreshing={playlists.isRefetching}
      onRefresh={() => void playlists.refetch()}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => router.back()}
        hitSlop={12}
      >
        <Txt variant="data">← Music Library</Txt>
      </Pressable>
      <Txt variant="micro" style={{ marginTop: space.md }}>
        Worship sets
      </Txt>
      <Txt variant="title">My playlists</Txt>

      <View style={{ gap: space.sm, marginTop: space.lg }}>
        <Input
          id="new-name"
          label="New playlist"
          value={name}
          onChangeText={setName}
          placeholder="Sunday, December 7"
          maxLength={120}
        />
        <Button
          label="Create playlist"
          disabled={!name.trim()}
          busy={actions.createPlaylist.isPending}
          onPress={() =>
            void run(async () => {
              const created = await actions.createPlaylist.mutateAsync({
                name: name.trim(),
              });
              setName("");
              open(created.id);
            })
          }
        />
      </View>

      {error ? (
        <View style={{ marginTop: space.md }}>
          <ErrorNote message={error} />
        </View>
      ) : null}

      <View style={{ gap: space.sm, marginTop: space.xl }}>
        {playlists.isPending ? <Loading /> : null}
        {playlists.error ? (
          <ErrorNote message={playlists.error.message} />
        ) : null}
        {playlists.data?.length === 0 ? (
          <Empty message="No playlists yet. Create one above." />
        ) : null}
        {playlists.data?.map((p) => {
          const unsaved = Boolean(store.getDraft(p.id));
          const isOpen = store.getCurrent() === p.id;
          return (
            <View key={p.id} style={[styles.card, isOpen && styles.open]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${p.name}`}
                onPress={() => open(p.id)}
                style={{ gap: 2 }}
              >
                <Txt variant="heading">{p.name}</Txt>
                {p.description ? (
                  <Txt variant="small" numberOfLines={2}>
                    {p.description}
                  </Txt>
                ) : null}
                <Txt variant="data" style={{ color: colors.ink2 }}>
                  {p._count.songs} {p._count.songs === 1 ? "song" : "songs"} ·
                  updated {shortDate(p.updatedAt)} · by {p.createdBy.firstName}
                  {isOpen ? " · open" : ""}
                  {unsaved ? " · unsaved changes" : ""}
                </Txt>
              </Pressable>
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Duplicate ${p.name}`}
                  onPress={() =>
                    void run(() => actions.duplicatePlaylist.mutateAsync(p.id))
                  }
                  style={styles.action}
                >
                  <Icon name="copy" size={16} />
                  <Txt variant="small">Duplicate</Txt>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${p.name}`}
                  onPress={() => setDeleting(p)}
                  style={styles.action}
                >
                  <Icon name="trash" size={16} />
                  <Txt variant="small">Delete</Txt>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>

      <ConfirmModal
        visible={Boolean(deleting)}
        title={`Delete ${deleting?.name ?? "playlist"}?`}
        message="The playlist disappears for the whole worship team. Songs stay in the library."
        confirmLabel="Delete"
        busy={actions.deletePlaylist.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          void run(async () => {
            if (!deleting) return;
            await actions.deletePlaylist.mutateAsync(deleting.id);
            store.clearDraft(deleting.id);
            if (store.getCurrent() === deleting.id) store.setCurrent(null);
            setDeleting(null);
          })
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.sm,
    padding: space.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    backgroundColor: colors.raised,
  },
  open: { borderColor: colors.ink, borderWidth: 1 },
  actions: { flexDirection: "row", gap: space.sm },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    minHeight: 36,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.sm,
  },
});
