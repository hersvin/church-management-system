import { autoScrollSpeed, formatTransposition } from "@cms/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
  type ScrollViewInstance,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChordSheet } from "../../src/components/music/chord-sheet";
import {
  FontSlider,
  useAutoScroll,
} from "../../src/components/music/viewer-controls";
import {
  Button,
  Chips,
  ErrorNote,
  Icon,
  Loading,
  Txt,
} from "../../src/components/ui";
import { radius, space } from "../../src/lib/theme";
import { useSongView } from "../../src/lib/use-song-view";
import {
  VIEWER_THEMES,
  viewerPrefs,
  type DisplayMode,
  type ViewerTheme,
} from "../../src/lib/viewer";
import { toChordProFile } from "@cms/shared";

/**
 * The song viewer: lyrics with chords in the playing key, a semitone transpose bar, display and theme
 * choices, a text-size slider, auto-scroll, and previous and next through the setlist it was opened from.
 */
export default function SongViewer() {
  const params = useLocalSearchParams<{
    songId: string;
    playlistId?: string;
    entry?: string;
  }>();
  const view = useSongView(params, "/music/song");
  const [theme, setTheme] = useState<ViewerTheme>(viewerPrefs.theme);
  const [mode, setMode] = useState<DisplayMode>(viewerPrefs.mode);
  const [font, setFont] = useState(viewerPrefs.font);
  const [options, setOptions] = useState(false);
  const [speedNudge, setSpeedNudge] = useState(1);
  const scroll = useRef<ScrollViewInstance>(null);
  const t = VIEWER_THEMES[theme];
  // The options panel stays on paper so its controls read the same in every theme.
  const paper = VIEWER_THEMES.paper;
  const song = view.song.data;
  const speed = autoScrollSpeed(song?.bpm, font) * speedNudge;
  const auto = useAutoScroll(scroll, speed);

  const remember = <K extends keyof typeof viewerPrefs>(
    key: K,
    value: (typeof viewerPrefs)[K],
  ) => {
    viewerPrefs[key] = value;
  };

  async function share() {
    if (!song?.chart) return;
    await Share.share({
      title: song.title,
      message: toChordProFile({ ...song, chart: song.chart }),
    });
  }

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: t.paper }]}
      edges={["top", "left", "right"]}
    >
      <View style={[styles.top, { borderBottomColor: t.hairline }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Txt variant="data" style={{ color: t.ink }}>
            ← Back
          </Txt>
        </Pressable>
        {view.place.index >= 0 ? (
          <Txt variant="micro" style={{ color: t.ink2 }}>
            Song {view.place.index + 1} of {view.place.count}
          </Txt>
        ) : (
          <Txt variant="micro" style={{ color: t.ink2 }}>
            Library
          </Txt>
        )}
        <View style={styles.topActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View options"
            onPress={() => setOptions((o) => !o)}
            hitSlop={8}
          >
            <Txt variant="data" style={{ color: t.ink }}>
              Aa
            </Txt>
          </Pressable>
          {song?.chart ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open stage mode"
              onPress={view.openOther}
              hitSlop={8}
            >
              <Txt variant="data" style={{ color: t.ink }}>
                Stage
              </Txt>
            </Pressable>
          ) : null}
        </View>
      </View>

      {view.song.isPending ? <Loading /> : null}
      {view.song.error ? (
        <View style={{ padding: space.lg }}>
          <ErrorNote message={view.song.error.message} />
        </View>
      ) : null}

      {song ? (
        <>
          <ScrollView
            ref={scroll}
            contentContainerStyle={styles.content}
            {...auto.scrollProps}
          >
            <Txt variant="title" style={{ color: t.ink }}>
              {song.title}
            </Txt>
            <Txt variant="small" style={{ color: t.ink2 }}>
              {[song.artist, song.composer, song.bpm ? `${song.bpm} BPM` : null]
                .filter(Boolean)
                .join(" · ") || "Artist not listed"}
            </Txt>

            {/* Transpose bar: Song key, then the New key moved a semitone at a time. */}
            <View
              style={[
                styles.transpose,
                { borderColor: t.hairline, backgroundColor: t.raised },
              ]}
            >
              <View style={{ gap: 2 }}>
                <Txt variant="micro" style={{ color: t.ink2 }}>
                  Song key
                </Txt>
                <Txt variant="dataLarge" style={{ color: t.ink, fontSize: 22 }}>
                  {view.originalKey ?? "?"}
                </Txt>
              </View>
              <View style={styles.stepper}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Down a semitone"
                  disabled={!view.originalKey}
                  onPress={() => view.step(-1)}
                  style={[styles.stepButton, { borderColor: t.ink }]}
                >
                  <Txt
                    variant="dataLarge"
                    style={{ color: t.ink, fontSize: 22 }}
                  >
                    −
                  </Txt>
                </Pressable>
                <View
                  style={{ alignItems: "center", minWidth: 80 }}
                  accessibilityLiveRegion="polite"
                >
                  <Txt variant="micro" style={{ color: t.ink2 }}>
                    New key
                  </Txt>
                  <Txt
                    variant="dataLarge"
                    style={{ color: t.ink, fontSize: 22 }}
                  >
                    {view.selectedKey ?? "?"}
                  </Txt>
                  <Txt variant="data" style={{ color: t.ink2, fontSize: 11 }}>
                    {view.originalKey
                      ? formatTransposition(view.shift)
                      : "Set the key"}
                  </Txt>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Up a semitone"
                  disabled={!view.originalKey}
                  onPress={() => view.step(1)}
                  style={[styles.stepButton, { borderColor: t.ink }]}
                >
                  <Txt
                    variant="dataLarge"
                    style={{ color: t.ink, fontSize: 22 }}
                  >
                    +
                  </Txt>
                </Pressable>
              </View>
            </View>
            <View style={styles.keyActions}>
              {view.originalKey && view.shift !== 0 ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => view.chooseKey(view.originalKey)}
                  hitSlop={8}
                >
                  <Txt variant="data" style={{ color: t.ink }}>
                    Revert to original
                  </Txt>
                </Pressable>
              ) : null}
              {view.row && view.dirty ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityHint="Saves the playlist with this key"
                  onPress={() => void view.saveKey()}
                  hitSlop={8}
                >
                  <Txt variant="data" style={{ color: t.ink }}>
                    {view.saving ? "Saving…" : "Save key to playlist"}
                  </Txt>
                </Pressable>
              ) : null}
              {!view.originalKey ? (
                <Txt variant="small" style={{ color: t.ink2 }}>
                  Set the song key in the chart editor to transpose.
                </Txt>
              ) : !view.row ? (
                <Txt variant="small" style={{ color: t.ink2 }}>
                  Key changes here are for viewing; open the song from a
                  playlist to keep one.
                </Txt>
              ) : null}
            </View>
            {view.saveError ? (
              <ErrorNote message={view.saveError.message} />
            ) : null}

            {options ? (
              <View
                style={[
                  styles.options,
                  {
                    borderColor: paper.hairline,
                    backgroundColor: paper.raised,
                  },
                ]}
              >
                <Txt variant="micro" style={{ color: paper.ink2 }}>
                  Show
                </Txt>
                <Chips
                  label="Show"
                  value={mode}
                  onChange={(m) => {
                    setMode(m);
                    remember("mode", m);
                  }}
                  options={[
                    { value: "both", label: "Chords and lyrics" },
                    { value: "lyrics", label: "Lyrics only" },
                    { value: "chords", label: "Chords only" },
                  ]}
                />
                <Txt variant="micro" style={{ color: paper.ink2 }}>
                  Theme
                </Txt>
                <Chips
                  label="Theme"
                  value={theme}
                  onChange={(v) => {
                    setTheme(v);
                    remember("theme", v);
                  }}
                  options={(Object.keys(VIEWER_THEMES) as ViewerTheme[]).map(
                    (k) => ({ value: k, label: VIEWER_THEMES[k].label }),
                  )}
                />
                <Txt variant="micro" style={{ color: paper.ink2 }}>
                  Text size
                </Txt>
                <FontSlider
                  value={font}
                  palette={paper}
                  onChange={(v) => {
                    setFont(v);
                    remember("font", v);
                  }}
                />
                <View
                  style={{
                    flexDirection: "row",
                    gap: space.sm,
                    flexWrap: "wrap",
                  }}
                >
                  <Button
                    label="Edit chart"
                    variant="outline"
                    onPress={() =>
                      router.push({
                        pathname: "/music/chart",
                        params: { songId: song.id },
                      })
                    }
                  />
                  {song.chart ? (
                    <Button
                      label="Share as ChordPro"
                      variant="outline"
                      onPress={() => void share()}
                    />
                  ) : null}
                </View>
              </View>
            ) : null}

            <View style={{ marginTop: space.lg }}>
              {view.lines.length ? (
                <ChordSheet
                  lines={view.lines}
                  size={font}
                  mode={mode}
                  palette={t}
                />
              ) : (
                <View
                  style={[
                    styles.options,
                    {
                      gap: space.md,
                      borderColor: paper.hairline,
                      backgroundColor: paper.raised,
                    },
                  ]}
                >
                  <Txt variant="body" style={{ color: paper.ink }}>
                    No chords or lyrics yet. Add them from your church&apos;s
                    licensed copy (for example CCLI SongSelect), written in the
                    song key.
                  </Txt>
                  <Button
                    label="Add chords and lyrics"
                    onPress={() =>
                      router.push({
                        pathname: "/music/chart",
                        params: { songId: song.id },
                      })
                    }
                  />
                </View>
              )}
            </View>
          </ScrollView>

          {/* Bottom bar: previous, auto-scroll, next. */}
          <View
            style={[
              styles.bar,
              { borderTopColor: t.hairline, backgroundColor: t.raised },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous song"
              disabled={!view.place.previous}
              onPress={view.previous}
              style={[
                styles.barButton,
                !view.place.previous && { opacity: 0.3 },
              ]}
            >
              <Txt variant="data" style={{ color: t.ink }}>
                ‹ Prev
              </Txt>
            </Pressable>
            <View style={styles.scrollControls}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Scroll slower"
                onPress={() => setSpeedNudge((s) => Math.max(0.25, s - 0.25))}
                style={styles.barButton}
              >
                <Txt variant="data" style={{ color: t.ink }}>
                  −
                </Txt>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  auto.playing ? "Pause auto-scroll" : "Start auto-scroll"
                }
                onPress={auto.toggle}
                disabled={!view.lines.length}
                style={[styles.play, { backgroundColor: t.ink }]}
              >
                <Icon
                  name={auto.playing ? "pause" : "play"}
                  size={18}
                  color={t.paper}
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Scroll faster"
                onPress={() => setSpeedNudge((s) => Math.min(3, s + 0.25))}
                style={styles.barButton}
              >
                <Txt variant="data" style={{ color: t.ink }}>
                  +
                </Txt>
              </Pressable>
              <Txt variant="data" style={{ color: t.ink2, fontSize: 11 }}>
                {speedNudge.toFixed(2).replace(/\.?0+$/, "")}x
              </Txt>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next song"
              disabled={!view.place.next}
              onPress={view.next}
              style={[styles.barButton, !view.place.next && { opacity: 0.3 }]}
            >
              <Txt variant="data" style={{ color: t.ink }}>
                Next ›
              </Txt>
            </Pressable>
          </View>
        </>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topActions: { flexDirection: "row", gap: space.lg },
  content: { padding: space.lg, gap: space.sm, paddingBottom: space.xxl * 3 },
  transpose: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: space.md,
  },
  stepper: { flexDirection: "row", alignItems: "center", gap: space.sm },
  stepButton: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  keyActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.lg,
    minHeight: 32,
  },
  options: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    paddingBottom: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  barButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.xs,
  },
  scrollControls: { flexDirection: "row", alignItems: "center", gap: space.xs },
  play: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
});
