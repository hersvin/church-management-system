import { MUSIC_KEYS } from "@cms/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import {
  Button,
  Chips,
  Empty,
  ErrorNote,
  Icon,
  Input,
  Loading,
  Screen,
  Txt,
} from "../../src/components/ui";
import { shortDate } from "../../src/lib/format";
import { useLibrary, type LibraryQuery } from "../../src/lib/music-queries";
import { colors, radius, space } from "../../src/lib/theme";

const SORTS = [
  { value: "title", label: "Title" },
  { value: "artist", label: "Artist" },
  { value: "key", label: "Key" },
  { value: "updated", label: "Recent" },
] as const;
const CHART = [
  { value: "any", label: "All songs" },
  { value: "yes", label: "With chords" },
  { value: "no", label: "Needs chords" },
] as const;

/** Every song in the church library. Tap one to open it in the viewer; Add song types one in by hand. */
export default function SongLibrary() {
  const [text, setText] = useState("");
  const [query, setQuery] = useState<LibraryQuery>({ sort: "title" });
  const [chart, setChart] = useState<(typeof CHART)[number]["value"]>("any");
  const [key, setKey] = useState("");
  const songs = useLibrary(query);

  const apply = (next: Partial<LibraryQuery>) =>
    setQuery((q) => ({ ...q, ...next }));

  return (
    <Screen
      refreshing={songs.isRefetching}
      onRefresh={() => void songs.refetch()}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => router.back()}
        hitSlop={12}
      >
        <Txt variant="data">← Music Library</Txt>
      </Pressable>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Txt variant="micro">Library</Txt>
          <Txt variant="title">All songs</Txt>
        </View>
        <Button label="Add song" onPress={() => router.push("/music/chart")} />
      </View>

      <View style={{ gap: space.sm, marginTop: space.md }}>
        <Input
          id="library-search"
          label="Search title, artist, or composer"
          value={text}
          onChangeText={setText}
          onSubmitEditing={() => apply({ q: text })}
          returnKeyType="search"
          placeholder="Goodness of God"
          autoCorrect={false}
        />
        <Button
          label="Search"
          variant="outline"
          onPress={() => apply({ q: text })}
        />
        <Txt variant="micro">Sort by</Txt>
        <Chips
          label="Sort by"
          value={query.sort}
          onChange={(sort) => apply({ sort })}
          options={SORTS}
        />
        <Chips
          label="Chords"
          value={chart}
          onChange={(v) => {
            setChart(v);
            apply({ hasChart: v === "any" ? undefined : v === "yes" });
          }}
          options={CHART}
        />
        <Txt variant="micro">Song key</Txt>
        <Chips
          label="Song key"
          value={key}
          onChange={(k) => {
            setKey(k);
            apply({ originalKey: k || undefined });
          }}
          options={[
            { value: "", label: "Any" },
            ...MUSIC_KEYS.map((k) => ({ value: k as string, label: k })),
          ]}
        />
      </View>

      <View style={{ gap: space.sm, marginTop: space.lg }}>
        {songs.isPending ? <Loading /> : null}
        {songs.error ? <ErrorNote message={songs.error.message} /> : null}
        {songs.data ? (
          <Txt variant="data" style={{ color: colors.ink2 }}>
            {songs.data.length} {songs.data.length === 1 ? "song" : "songs"}
          </Txt>
        ) : null}
        {songs.data?.length === 0 ? (
          <Empty message="No songs match. Search the music catalogs, or press Add song." />
        ) : null}
        {songs.data?.map((s) => (
          <Pressable
            key={s.id}
            accessibilityRole="button"
            accessibilityLabel={`${s.title}, key ${s.originalKey ?? "not set"}${s.hasChart ? "" : ", no chords yet"}`}
            onPress={() =>
              router.push({ pathname: "/music/song", params: { songId: s.id } })
            }
            style={({ pressed }) => [
              styles.row,
              pressed && { backgroundColor: colors.sunk },
            ]}
          >
            <View style={styles.key}>
              <Txt variant="data" style={{ fontSize: 15 }}>
                {s.originalKey ?? "?"}
              </Txt>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt
                variant="heading"
                numberOfLines={1}
                style={{ fontSize: 15, lineHeight: 20 }}
              >
                {s.title}
              </Txt>
              <Txt variant="small" numberOfLines={1}>
                {[
                  s.artist ?? s.composer ?? "Artist not listed",
                  s.bpm ? `${s.bpm} BPM` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Txt>
              <Txt variant="data" style={{ color: colors.ink2, fontSize: 11 }}>
                {s.hasChart ? "Chords and lyrics" : "No chords yet"} · updated{" "}
                {shortDate(s.updatedAt)}
              </Txt>
            </View>
            <Icon name="chevronRight" size={18} color={colors.ink2} />
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: space.md,
    marginTop: space.md,
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
  key: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
});
