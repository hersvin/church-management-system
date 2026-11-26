import { formatTransposition, transposeSemitones } from "@cms/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import ReorderableList, {
  useIsActive,
  useReorderableDrag,
  type ReorderableListReorderEvent,
} from "react-native-reorderable-list";
import {
  duplicateEntry,
  moveEntry,
  removeEntry,
  setKey,
  type DraftEntry,
  type PlaylistDraft,
} from "../../lib/music";
import { colors, radius, space } from "../../lib/theme";
import { Button, Empty, ErrorNote, Icon, Input, Txt } from "../ui";
import { KeyPicker } from "./key-picker";

function SongRow({
  entry,
  index,
  count,
  onKey,
  onDuplicate,
  onRemove,
  onMove,
  onOpen,
}: {
  entry: DraftEntry;
  index: number;
  count: number;
  onKey: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onMove: (to: number) => void;
  onOpen: () => void;
}) {
  const drag = useReorderableDrag();
  const active = useIsActive();
  const shift = transposeSemitones(entry.originalKey, entry.selectedKey);
  const label = `${index + 1}. ${entry.song.title}`;
  return (
    <View
      style={[styles.row, active && styles.rowActive]}
      accessible
      accessibilityLabel={`${label}, key ${entry.selectedKey ?? "not set"}`}
      accessibilityActions={[
        ...(index > 0 ? [{ name: "moveUp", label: "Move up" }] : []),
        ...(index < count - 1
          ? [{ name: "moveDown", label: "Move down" }]
          : []),
        { name: "activate", label: "Open chords and lyrics" },
        { name: "changeKey", label: "Change key" },
        { name: "duplicate", label: "Duplicate" },
        { name: "remove", label: "Remove" },
      ]}
      onAccessibilityAction={(e) => {
        const name = e.nativeEvent.actionName;
        if (name === "moveUp") onMove(index - 1);
        if (name === "moveDown") onMove(index + 1);
        if (name === "activate") onOpen();
        if (name === "changeKey") onKey();
        if (name === "duplicate") onDuplicate();
        if (name === "remove") onRemove();
      }}
    >
      <Pressable
        onLongPress={drag}
        delayLongPress={150}
        accessibilityLabel="Drag to reorder"
        hitSlop={8}
        style={styles.grip}
      >
        <Txt variant="data" style={{ color: colors.ink2 }}>
          {index + 1}
        </Txt>
        <Icon name="grip" size={20} color={colors.ink2} />
      </Pressable>
      <View style={{ flex: 1, gap: 2 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open chords and lyrics for ${entry.song.title}`}
          onPress={onOpen}
          style={({ pressed }) => [{ gap: 2 }, pressed && { opacity: 0.6 }]}
        >
          <Txt
            variant="heading"
            numberOfLines={2}
            style={{ fontSize: 15, lineHeight: 20 }}
          >
            {entry.song.title}
          </Txt>
          <Txt variant="small" numberOfLines={1}>
            {entry.song.artist ?? "Artist not listed"} · Chords and lyrics →
          </Txt>
        </Pressable>
        <View style={styles.keys}>
          <Txt variant="data">Original {entry.originalKey ?? "not set"}</Txt>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Change key of ${entry.song.title}`}
            onPress={onKey}
            style={styles.keyButton}
          >
            <Txt variant="data" style={{ color: colors.paper }}>
              Key {entry.selectedKey ?? "set"}
            </Txt>
          </Pressable>
          <Txt variant="data" style={{ color: colors.ink2 }}>
            {entry.originalKey && entry.selectedKey
              ? formatTransposition(shift)
              : ""}
          </Txt>
        </View>
      </View>
      <View style={{ gap: space.xs }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Duplicate ${entry.song.title}`}
          onPress={onDuplicate}
          style={styles.small}
        >
          <Icon name="copy" size={16} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${entry.song.title}`}
          onPress={onRemove}
          style={styles.small}
        >
          <Icon name="trash" size={16} />
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Right panel: the open playlist being arranged. Long-press the number to drag a song; every song has its
 * own key. Nothing is stored until Save, but the arrangement survives moving between screens.
 */
export function PlaylistPanel({
  draft,
  dirty,
  onChange,
  onSave,
  onDiscard,
  saving,
  error,
  notice,
  onOpenPlaylists,
}: {
  draft: PlaylistDraft;
  dirty: boolean;
  onChange: (draft: PlaylistDraft) => void;
  onSave: () => void;
  onDiscard: () => void;
  saving: boolean;
  error: string | null;
  notice: string | null;
  onOpenPlaylists: () => void;
}) {
  const [keyFor, setKeyFor] = useState<string | null>(null);
  const editing = draft.entries.find((e) => e.key === keyFor) ?? null;

  const header = (
    <View style={{ gap: space.md, marginBottom: space.md }}>
      <View style={styles.headRow}>
        <Txt variant="micro">Playlist</Txt>
        <Pressable
          accessibilityRole="button"
          onPress={onOpenPlaylists}
          hitSlop={8}
        >
          <Txt variant="data">My playlists →</Txt>
        </Pressable>
      </View>
      <Input
        id="playlist-name"
        label="Name"
        value={draft.name}
        onChangeText={(name) => onChange({ ...draft, name })}
        maxLength={120}
      />
      <Input
        id="playlist-description"
        label="Description"
        value={draft.description ?? ""}
        onChangeText={(description) => onChange({ ...draft, description })}
        placeholder="Sunday morning set"
        multiline
        maxLength={500}
      />
      <View style={styles.headRow}>
        <Txt variant="small">
          {draft.entries.length} {draft.entries.length === 1 ? "song" : "songs"}
          {dirty ? " · unsaved changes" : " · saved"}
        </Txt>
      </View>
      {notice ? <Txt variant="small">{notice}</Txt> : null}
      {error ? <ErrorNote message={error} /> : null}
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Button
            label="Save playlist"
            onPress={onSave}
            busy={saving}
            disabled={!dirty || !draft.name.trim()}
          />
        </View>
        {dirty ? (
          <View style={{ flex: 1 }}>
            <Button
              label="Discard changes"
              variant="outline"
              onPress={onDiscard}
              disabled={saving}
            />
          </View>
        ) : null}
      </View>
      {draft.entries.length > 1 ? (
        <Txt variant="small">
          Long-press a number to drag a song into place.
        </Txt>
      ) : null}
    </View>
  );

  return (
    <>
      <ReorderableList
        data={draft.entries}
        keyExtractor={(e) => e.key}
        onReorder={({ from, to }: ReorderableListReorderEvent) =>
          onChange(moveEntry(draft, from, to))
        }
        ListHeaderComponent={header}
        ListEmptyComponent={
          <Empty message="No songs yet. Search, then press Add on a song." />
        }
        contentContainerStyle={{
          padding: space.lg,
          paddingBottom: space.xxl * 2,
        }}
        ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
        renderItem={({ item, index }) => (
          <SongRow
            entry={item}
            index={index}
            count={draft.entries.length}
            onKey={() => setKeyFor(item.key)}
            onDuplicate={() => onChange(duplicateEntry(draft, item.key))}
            onRemove={() => onChange(removeEntry(draft, item.key))}
            onMove={(to) => onChange(moveEntry(draft, index, to))}
            onOpen={() =>
              router.push({
                pathname: "/music/song",
                params: {
                  songId: item.song.id,
                  playlistId: draft.id,
                  entry: item.key,
                },
              })
            }
          />
        )}
      />
      <KeyPicker
        visible={Boolean(editing)}
        title={editing?.song.title ?? ""}
        originalKey={editing?.originalKey ?? null}
        selectedKey={editing?.selectedKey ?? null}
        onSelect={(k) => editing && onChange(setKey(draft, editing.key, k))}
        onClose={() => setKeyFor(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  headRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    backgroundColor: colors.raised,
  },
  rowActive: {
    borderColor: colors.ink,
    borderWidth: 1,
    backgroundColor: colors.paper,
  },
  grip: {
    alignItems: "center",
    gap: 2,
    width: 32,
    minHeight: 44,
    justifyContent: "center",
  },
  keys: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.sm,
    marginTop: space.xs,
  },
  keyButton: {
    backgroundColor: colors.ink,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    minHeight: 32,
    justifyContent: "center",
  },
  small: {
    width: 40,
    height: 36,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
});
