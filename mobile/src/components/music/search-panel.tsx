import { MUSIC_KEYS } from "@cms/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Image, Linking, Pressable, StyleSheet, View } from "react-native";
import type { LibrarySong, SearchResult } from "../../lib/music";
import { useCatalogSearch, type CatalogQuery } from "../../lib/music-queries";
import { useSession } from "../../lib/session";
import { colors, radius, space } from "../../lib/theme";
import {
  Button,
  Chips,
  Empty,
  ErrorNote,
  Icon,
  Input,
  Loading,
  Txt,
} from "../ui";
import { usePreview } from "./use-preview";

type Mode = "catalog" | "library";
const FIELDS = [
  { value: "any", label: "Anything" },
  { value: "title", label: "Song title" },
  { value: "artist", label: "Artist" },
] as const;
const SOURCE_NAME = {
  ITUNES: "Apple Music",
  MUSICBRAINZ: "MusicBrainz",
  MANUAL: "Added by hand",
} as const;

const minutes = (ms: number | null) =>
  ms
    ? `${Math.floor(ms / 60000)}:${String(Math.round((ms % 60000) / 1000)).padStart(2, "0")}`
    : null;

/** What the Add button hands to the add sheet: a catalog result or a song already in the library. */
export type AddCandidate =
  | { kind: "catalog"; result: SearchResult }
  | { kind: "library"; song: LibrarySong };

function Meta({ parts }: { parts: (string | null | undefined)[] }) {
  const shown = parts.filter(Boolean);
  return shown.length ? <Txt variant="small">{shown.join(" · ")}</Txt> : null;
}

function ResultRow({
  title,
  artist,
  originalKey,
  bpm,
  genre,
  extra,
  artworkUrl,
  previewUrl,
  sourceLabel,
  sourceUrl,
  playing,
  onPreview,
  onAdd,
}: {
  title: string;
  artist: string | null;
  originalKey: string | null;
  bpm?: number | null;
  genre: string | null;
  extra?: string | null;
  artworkUrl: string | null;
  previewUrl: string | null;
  sourceLabel: string;
  sourceUrl: string | null;
  playing: boolean;
  onPreview: (url: string) => void;
  onAdd: () => void;
}) {
  return (
    <View style={styles.row}>
      {artworkUrl ? (
        <Image
          source={{ uri: artworkUrl }}
          style={styles.art}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={[styles.art, styles.artEmpty]}>
          <Icon name="music" size={20} color={colors.ink2} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Txt
          variant="heading"
          numberOfLines={2}
          style={{ fontSize: 15, lineHeight: 20 }}
        >
          {title}
        </Txt>
        <Meta parts={[artist ?? "Artist not listed"]} />
        <Meta
          parts={[
            originalKey ? `Key ${originalKey}` : "Key not set",
            bpm ? `${bpm} BPM` : null,
            genre,
            extra,
          ]}
        />
        <View style={styles.actions}>
          {sourceUrl ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Open ${title} on ${sourceLabel}`}
              onPress={() => void Linking.openURL(sourceUrl)}
              hitSlop={8}
              style={styles.source}
            >
              <Icon name="link" size={14} color={colors.ink2} />
              <Txt variant="micro">{sourceLabel}</Txt>
            </Pressable>
          ) : (
            <Txt variant="micro">{sourceLabel}</Txt>
          )}
          <View style={{ flex: 1 }} />
          {previewUrl ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                playing
                  ? `Stop preview of ${title}`
                  : `Play preview of ${title}`
              }
              onPress={() => onPreview(previewUrl)}
              style={styles.iconButton}
            >
              <Icon name={playing ? "pause" : "play"} size={16} />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add ${title} to playlist`}
            onPress={onAdd}
            style={styles.addButton}
          >
            <Icon name="plus" size={16} color={colors.paper} />
            <Txt variant="small" style={{ color: colors.paper }}>
              Add
            </Txt>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/** Left panel: search the outside catalogs, or the church's own library (where key and language are known). */
export function SearchPanel({
  onAdd,
}: {
  onAdd: (candidate: AddCandidate) => void;
}) {
  const { api } = useSession();
  const [mode, setMode] = useState<Mode>("catalog");
  const [text, setText] = useState("");
  const [field, setField] = useState<CatalogQuery["field"]>("any");
  const [genre, setGenre] = useState("");
  const [language, setLanguage] = useState("");
  const [key, setKey] = useState<string>("");
  const [query, setQuery] = useState<CatalogQuery | null>(null);
  const [libraryQuery, setLibraryQuery] = useState<string | null>(null);
  const preview = usePreview();

  const catalog = useCatalogSearch(mode === "catalog" ? query : null);
  const library = useQuery({
    queryKey: ["music", "songs", libraryQuery],
    enabled: mode === "library" && libraryQuery !== null,
    queryFn: () => api.request<LibrarySong[]>(`/music/songs?${libraryQuery}`),
  });

  function search() {
    if (mode === "catalog") {
      if (text.trim().length < 2) return;
      setQuery({ q: text.trim(), field, genre: genre.trim() || undefined });
    } else {
      const params = new URLSearchParams();
      if (text.trim()) params.set("q", text.trim());
      if (genre.trim()) params.set("genre", genre.trim());
      if (language.trim()) params.set("language", language.trim());
      if (key) params.set("originalKey", key);
      setLibraryQuery(params.toString());
    }
  }

  const tooShort = mode === "catalog" && text.trim().length < 2;

  return (
    <View style={{ gap: space.md }}>
      <Chips
        label="Search in"
        value={mode}
        onChange={(m) => {
          preview.stop();
          setMode(m);
        }}
        options={[
          { value: "catalog", label: "Music catalogs" },
          { value: "library", label: "Our library" },
        ]}
      />
      <Input
        id="music-search"
        label={
          mode === "catalog"
            ? "Song title, artist, or keywords"
            : "Title, artist, or composer"
        }
        value={text}
        onChangeText={setText}
        placeholder="What a Beautiful Name"
        returnKeyType="search"
        autoCorrect={false}
        onSubmitEditing={search}
      />
      {mode === "catalog" ? (
        <Chips
          label="Search by"
          value={field}
          onChange={setField}
          options={FIELDS}
        />
      ) : null}
      <View style={styles.filters}>
        <View style={{ flex: 1 }}>
          <Input
            id="music-genre"
            label="Genre"
            value={genre}
            onChangeText={setGenre}
            placeholder="Gospel"
            autoCorrect={false}
          />
        </View>
        {mode === "library" ? (
          <View style={{ flex: 1 }}>
            <Input
              id="music-language"
              label="Language"
              value={language}
              onChangeText={setLanguage}
              placeholder="Tagalog"
              autoCorrect={false}
            />
          </View>
        ) : null}
      </View>
      {mode === "library" ? (
        <View style={{ gap: space.xs }}>
          <Txt variant="micro">Original key</Txt>
          <Chips
            label="Original key"
            value={key}
            onChange={setKey}
            options={[
              { value: "", label: "Any" },
              ...MUSIC_KEYS.map((k) => ({ value: k as string, label: k })),
            ]}
          />
        </View>
      ) : (
        <Txt variant="small">
          Catalogs do not list musical key or language. Set the key when you add
          a song; filter by key in Our library.
        </Txt>
      )}
      <Button
        label="Search"
        onPress={search}
        disabled={tooShort}
        busy={catalog.isFetching || library.isFetching}
      />

      {mode === "catalog" ? (
        <>
          {catalog.data?.unavailable.length ? (
            <ErrorNote
              message={`${catalog.data.unavailable.map((s) => SOURCE_NAME[s]).join(" and ")} could not be reached. Showing the other results.`}
            />
          ) : null}
          {catalog.error ? <ErrorNote message={catalog.error.message} /> : null}
          {catalog.isFetching && !catalog.data ? <Loading /> : null}
          {!query ? (
            <Empty message="Search a catalog to find songs. Results come from Apple Music and MusicBrainz." />
          ) : null}
          {catalog.data && catalog.data.songs.length === 0 ? (
            <Empty message="No songs found. Try fewer words or search by artist." />
          ) : null}
          {catalog.data?.songs.map((r) => (
            <ResultRow
              key={`${r.source}:${r.externalId}`}
              title={r.title}
              artist={r.artist}
              originalKey={r.originalKey}
              genre={r.genre}
              extra={
                [r.album, minutes(r.durationMs)].filter(Boolean).join(" · ") ||
                null
              }
              artworkUrl={r.artworkUrl}
              previewUrl={r.previewUrl}
              sourceLabel={`${SOURCE_NAME[r.source]}${r.librarySongId ? " · in library" : ""}`}
              sourceUrl={r.sourceUrl}
              playing={preview.playingUrl === r.previewUrl}
              onPreview={preview.toggle}
              onAdd={() => onAdd({ kind: "catalog", result: r })}
            />
          ))}
        </>
      ) : (
        <>
          {library.error ? <ErrorNote message={library.error.message} /> : null}
          {library.isFetching && !library.data ? <Loading /> : null}
          {libraryQuery === null ? (
            <Empty message="Search the songs your team has already added." />
          ) : null}
          {library.data && library.data.length === 0 ? (
            <Empty message="No library songs match. Search the music catalogs to add some." />
          ) : null}
          {library.data?.map((s) => (
            <ResultRow
              key={s.id}
              title={s.title}
              artist={s.artist ?? s.composer}
              originalKey={s.originalKey}
              bpm={s.bpm}
              genre={s.genre}
              extra={s.language}
              artworkUrl={s.artworkUrl}
              previewUrl={s.previewUrl}
              sourceLabel={SOURCE_NAME[s.source]}
              sourceUrl={s.sourceUrl}
              playing={preview.playingUrl === s.previewUrl}
              onPreview={preview.toggle}
              onAdd={() => onAdd({ kind: "library", song: s })}
            />
          ))}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: "row", gap: space.sm },
  row: {
    flexDirection: "row",
    gap: space.md,
    padding: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    backgroundColor: colors.raised,
  },
  art: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.sunk,
  },
  artEmpty: { alignItems: "center", justifyContent: "center" },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginTop: space.xs,
  },
  source: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 32 },
  iconButton: {
    width: 40,
    height: 36,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    backgroundColor: colors.ink,
  },
});
