import {
  MUSIC_KEYS,
  chordsOverLyricsToChordPro,
  diatonicChords,
  looksLikeChordsOverLyrics,
  parseChart,
  toChordProFile,
  type MusicKey,
} from "@cms/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChordSheet } from "../../src/components/music/chord-sheet";
import {
  Button,
  Chips,
  ErrorNote,
  Input,
  Loading,
  Txt,
} from "../../src/components/ui";
import {
  useMusicActions,
  useSaveChart,
  useSong,
} from "../../src/lib/music-queries";
import { useSession } from "../../src/lib/session";
import { colors, fonts, radius, space } from "../../src/lib/theme";

const EXAMPLE =
  "[Verse 1]\nYou were the [D]Word at the be[A]ginning\nOne with [Bm]God the Lord Most [G]High\n\n[Chorus]\n[D]What a beautiful [A/C#]name it is";
const SECTIONS = ["[Verse 1]", "[Chorus]", "[Bridge]", "[Tag]"];

/**
 * The chart editor: adds a song by hand, or edits an existing song's chords and lyrics. Chords go in square
 * brackets before the syllable where they are played, in the song key. Text copied with chords on their own
 * line above the lyrics converts in one tap.
 */
export default function ChartEditor() {
  const { songId } = useLocalSearchParams<{ songId?: string }>();
  const creating = !songId;
  const { api } = useSession();
  const song = useSong(songId);
  const saveChart = useSaveChart();
  const actions = useMusicActions();

  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [composer, setComposer] = useState("");
  const [bpm, setBpm] = useState("");
  const [genre, setGenre] = useState("");
  const [language, setLanguage] = useState("");
  const [key, setKey] = useState<string>("");
  const [text, setText] = useState("");
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  // Set only right after inserting a chord, then released, so normal typing is never fought.
  const [forced, setForced] = useState<
    { start: number; end: number } | undefined
  >(undefined);
  const [preview, setPreview] = useState(false);
  const [loaded, setLoaded] = useState(creating);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (song.data && !loaded) {
      setText(song.data.chart ?? "");
      setKey(song.data.originalKey ?? "");
      setComposer(song.data.composer ?? "");
      setBpm(song.data.bpm ? String(song.data.bpm) : "");
      setGenre(song.data.genre ?? "");
      setLanguage(song.data.language ?? "");
      setLoaded(true);
    }
  }, [song.data, loaded]);

  /** Puts a chord or heading at the cursor, so typing on a phone keyboard needs no brackets. */
  function insert(snippet: string) {
    const before = text.slice(0, selection.start);
    const after = text.slice(selection.end);
    const needsBreak =
      snippet.startsWith("[") &&
      SECTIONS.includes(snippet) &&
      before &&
      !before.endsWith("\n");
    const piece = needsBreak
      ? `\n${snippet}\n`
      : SECTIONS.includes(snippet)
        ? `${snippet}\n`
        : snippet;
    setText(before + piece + after);
    const at = before.length + piece.length;
    setSelection({ start: at, end: at });
    setForced({ start: at, end: at });
  }

  const tempo = bpm.trim() ? Number(bpm) : null;
  const tempoProblem =
    tempo !== null && (!Number.isInteger(tempo) || tempo < 20 || tempo > 300)
      ? "Tempo is a whole number from 20 to 300."
      : null;

  async function submit() {
    setError(null);
    if (tempoProblem) return setError(tempoProblem);
    setBusy(true);
    try {
      if (creating) {
        if (!title.trim()) {
          setBusy(false);
          return setError("Give the song a title.");
        }
        const created = await actions.addSong.mutateAsync({
          title: title.trim(),
          artist: artist.trim() || undefined,
          composer: composer.trim() || undefined,
          genre: genre.trim() || undefined,
          language: language.trim() || undefined,
          bpm: tempo ?? undefined,
          originalKey: (key || undefined) as MusicKey | undefined,
          source: "MANUAL",
          chart: text.trim() || undefined,
        });
        router.replace({
          pathname: "/music/song",
          params: { songId: created.id },
        });
      } else if (song.data) {
        const meta: Record<string, string | number | null> = {};
        if ((tempo ?? null) !== (song.data.bpm ?? null)) meta.bpm = tempo;
        if (composer.trim() !== (song.data.composer ?? ""))
          meta.composer = composer.trim() || null;
        if (genre.trim() !== (song.data.genre ?? ""))
          meta.genre = genre.trim() || null;
        if (language.trim() !== (song.data.language ?? ""))
          meta.language = language.trim() || null;
        if (Object.keys(meta).length)
          await api.request(`/music/songs/${song.data.id}`, {
            method: "PATCH",
            json: meta,
          });
        // Saved last, so the refresh it triggers shows the new details too.
        await saveChart.mutateAsync({
          id: song.data.id,
          chart: text.trim() ? text : null,
          originalKey:
            (key || null) !== (song.data.originalKey ?? null)
              ? key || null
              : undefined,
        });
        router.back();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function exportChart() {
    const name = creating
      ? title.trim() || "Untitled"
      : (song.data?.title ?? "Song");
    await Share.share({
      title: name,
      message: toChordProFile({
        title: name,
        artist: creating ? artist : song.data?.artist,
        originalKey: key || null,
        bpm: tempo,
        chart: text,
      }),
    });
  }

  const chords = diatonicChords(key || null);
  const convertible = looksLikeChordsOverLyrics(text);

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <View style={styles.top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Txt variant="data">← Cancel</Txt>
        </Pressable>
        <Txt variant="micro">{creating ? "Add song" : "Chords and lyrics"}</Txt>
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {!creating && song.isPending ? <Loading /> : null}
          {song.error ? <ErrorNote message={song.error.message} /> : null}
          {creating || song.data ? (
            <>
              {creating ? (
                <>
                  <Txt variant="title">Add a song</Txt>
                  <Input
                    id="song-title"
                    label="Title"
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Goodness of God"
                    maxLength={200}
                  />
                  <Input
                    id="song-artist"
                    label="Artist"
                    value={artist}
                    onChangeText={setArtist}
                    placeholder="Bethel Music"
                    maxLength={200}
                  />
                </>
              ) : (
                <>
                  <Txt variant="title">{song.data!.title}</Txt>
                  <Txt variant="small">
                    {song.data!.artist ?? "Artist not listed"}
                  </Txt>
                </>
              )}
              <View style={styles.pair}>
                <View style={{ flex: 1 }}>
                  <Input
                    id="song-composer"
                    label="Composer"
                    value={composer}
                    onChangeText={setComposer}
                    maxLength={200}
                  />
                </View>
                <View style={{ width: 110 }}>
                  <Input
                    id="song-bpm"
                    label="Tempo (BPM)"
                    value={bpm}
                    onChangeText={setBpm}
                    keyboardType="number-pad"
                    maxLength={3}
                    placeholder="72"
                  />
                </View>
              </View>
              <View style={styles.pair}>
                <View style={{ flex: 1 }}>
                  <Input
                    id="song-genre"
                    label="Genre"
                    value={genre}
                    onChangeText={setGenre}
                    maxLength={80}
                    placeholder="Worship"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    id="song-language"
                    label="Language"
                    value={language}
                    onChangeText={setLanguage}
                    maxLength={40}
                    placeholder="English"
                  />
                </View>
              </View>

              <View style={{ gap: space.xs }}>
                <Txt variant="micro">
                  Song key (the key the chart is written in)
                </Txt>
                <Chips
                  label="Song key"
                  value={key}
                  onChange={setKey}
                  options={[
                    { value: "", label: "Not set" },
                    ...MUSIC_KEYS.map((k) => ({
                      value: k as string,
                      label: k,
                    })),
                  ]}
                />
              </View>

              <Txt variant="small">
                Type or paste from your church&apos;s licensed copy (for example
                CCLI SongSelect). Put each chord in square brackets right before
                its syllable, like You were the [D]Word. A line with only a
                label, like [Chorus], becomes a heading.
              </Txt>

              <Chips
                label="View"
                value={preview ? "preview" : "edit"}
                onChange={(v) => setPreview(v === "preview")}
                options={[
                  { value: "edit", label: "Edit" },
                  { value: "preview", label: "Preview" },
                ]}
              />

              {preview ? (
                <View style={styles.preview}>
                  {text.trim() ? (
                    <ChordSheet lines={parseChart(text)} size={17} />
                  ) : (
                    <Txt variant="small">Nothing to preview yet.</Txt>
                  )}
                </View>
              ) : (
                <>
                  {/* Chord bar: the key's common chords and section headings, inserted at the cursor. */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.bar}
                    keyboardShouldPersistTaps="always"
                  >
                    {chords.length === 0 ? (
                      <Txt variant="small">
                        Set the song key to get its chords here.
                      </Txt>
                    ) : null}
                    {chords.map((c) => (
                      <Pressable
                        key={c}
                        accessibilityRole="button"
                        accessibilityLabel={`Insert ${c}`}
                        onPress={() => insert(`[${c}]`)}
                        style={styles.chip}
                      >
                        <Txt variant="data" style={{ fontSize: 15 }}>
                          {c}
                        </Txt>
                      </Pressable>
                    ))}
                    {SECTIONS.map((s) => (
                      <Pressable
                        key={s}
                        accessibilityRole="button"
                        accessibilityLabel={`Insert ${s} heading`}
                        onPress={() => insert(s)}
                        style={[styles.chip, styles.section]}
                      >
                        <Txt variant="data">{s.slice(1, -1)}</Txt>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <TextInput
                    accessibilityLabel="Chords and lyrics"
                    value={text}
                    onChangeText={setText}
                    selection={forced}
                    onSelectionChange={(e) => {
                      setSelection(e.nativeEvent.selection);
                      setForced(undefined);
                    }}
                    multiline
                    autoCapitalize="sentences"
                    autoCorrect={false}
                    spellCheck={false}
                    placeholder={EXAMPLE}
                    placeholderTextColor={colors.ink2}
                    maxLength={20000}
                    textAlignVertical="top"
                    style={styles.editor}
                  />
                </>
              )}
              {convertible ? (
                <View style={styles.notice}>
                  <Txt variant="small">
                    This looks like chords written on their own lines above the
                    lyrics.
                  </Txt>
                  <Button
                    label="Convert to bracketed chords"
                    variant="outline"
                    onPress={() => setText(chordsOverLyricsToChordPro(text))}
                  />
                </View>
              ) : null}
              <Txt variant="data" style={{ color: colors.ink2 }}>
                {text.length.toLocaleString()} of 20,000 characters
              </Txt>

              {error ? <ErrorNote message={error} /> : null}
              <Button
                label={creating ? "Add song" : "Save"}
                onPress={() => void submit()}
                busy={busy}
              />
              {text.trim() ? (
                <Button
                  label="Share as ChordPro"
                  variant="outline"
                  onPress={() => void exportChart()}
                />
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
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
  content: {
    padding: space.lg,
    paddingTop: 0,
    gap: space.md,
    paddingBottom: space.xxl * 2,
  },
  pair: { flexDirection: "row", gap: space.sm },
  bar: { gap: space.sm, alignItems: "center", paddingVertical: space.xs },
  chip: {
    minWidth: 48,
    height: 40,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.raised,
  },
  section: { borderColor: colors.hairline },
  editor: {
    minHeight: 320,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.sm,
    padding: space.md,
    backgroundColor: colors.raised,
    fontFamily: fonts.mono,
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink,
  },
  preview: {
    padding: space.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    backgroundColor: colors.raised,
  },
  notice: {
    gap: space.sm,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.ink,
    borderRadius: radius.md,
  },
});
