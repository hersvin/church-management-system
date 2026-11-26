import { chartSections, formatTransposition } from "@cms/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { ChordSheet } from "../../src/components/music/chord-sheet";
import {
  Metronome,
  useStayAwake,
} from "../../src/components/music/viewer-controls";
import { Chips, Loading, Txt } from "../../src/components/ui";
import { radius, space } from "../../src/lib/theme";
import { useSongView } from "../../src/lib/use-song-view";
import {
  VIEWER_THEMES,
  viewerPrefs,
  type DisplayMode,
  type ViewerTheme,
} from "../../src/lib/viewer";

/**
 * Stage mode: one section at a time in large type for a music stand or a phone on a mic stand.
 * Tap the right side or swipe left for the next section, the left side or swipe right to go back.
 * Past the last section it moves to the next song in the setlist. The screen stays on.
 */
export default function Stage() {
  const params = useLocalSearchParams<{
    songId: string;
    playlistId?: string;
    entry?: string;
  }>();
  const view = useSongView(params, "/music/stage");
  const { width } = useWindowDimensions();
  const [theme, setTheme] = useState<ViewerTheme>(
    viewerPrefs.theme === "paper" ? "dark" : viewerPrefs.theme,
  );
  const [mode, setMode] = useState<DisplayMode>(viewerPrefs.mode);
  const [index, setIndex] = useState(0);
  const [tools, setTools] = useState(false);
  const t = VIEWER_THEMES[theme];
  const sections = useMemo(() => chartSections(view.lines), [view.lines]);
  const size = Math.max(viewerPrefs.font + 8, width > 700 ? 34 : 26);
  useStayAwake(true, "stage");

  // A new song starts at its first section.
  useEffect(() => setIndex(0), [params.songId, params.entry]);

  function forward() {
    if (index < sections.length - 1) setIndex(index + 1);
    else if (view.place.next) view.next();
  }
  function back() {
    if (index > 0) setIndex(index - 1);
    else if (view.place.previous) view.previous();
  }

  const swipe = Gesture.Pan()
    .activeOffsetX([-30, 30])
    .onEnd((e) => {
      if (e.translationX < -60) scheduleOnRN(forward);
      else if (e.translationX > 60) scheduleOnRN(back);
    });

  const section = sections[index];
  const upcoming = sections[index + 1];

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: t.paper }]}
      edges={["top", "left", "right", "bottom"]}
    >
      <View style={styles.top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Leave stage mode"
          onPress={view.openOther}
          hitSlop={12}
        >
          <Txt variant="data" style={{ color: t.ink }}>
            ✕ Exit
          </Txt>
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Txt variant="data" numberOfLines={1} style={{ color: t.ink }}>
            {view.song.data?.title ?? ""}
          </Txt>
          <Txt variant="micro" style={{ color: t.ink2 }}>
            {view.selectedKey ? `Key ${view.selectedKey}` : "Key not set"}
            {view.originalKey && view.shift
              ? ` (${formatTransposition(view.shift)})`
              : ""}
            {view.place.index >= 0
              ? ` · Song ${view.place.index + 1} of ${view.place.count}`
              : ""}
          </Txt>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Stage tools"
          onPress={() => setTools((v) => !v)}
          hitSlop={12}
        >
          <Txt variant="data" style={{ color: t.ink }}>
            Tools
          </Txt>
        </Pressable>
      </View>

      {tools ? (
        <View
          style={[
            styles.tools,
            { backgroundColor: VIEWER_THEMES.paper.raised },
          ]}
        >
          <Chips
            label="Theme"
            value={theme}
            onChange={setTheme}
            options={(Object.keys(VIEWER_THEMES) as ViewerTheme[]).map((k) => ({
              value: k,
              label: VIEWER_THEMES[k].label,
            }))}
          />
          <Chips
            label="Show"
            value={mode}
            onChange={setMode}
            options={[
              { value: "both", label: "Chords and lyrics" },
              { value: "lyrics", label: "Lyrics" },
              { value: "chords", label: "Chords" },
            ]}
          />
          <Metronome
            bpm={view.song.data?.bpm ?? null}
            palette={VIEWER_THEMES.paper}
          />
          <View style={styles.keys}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Down a semitone"
              onPress={() => view.step(-1)}
              style={styles.keyButton}
            >
              <Txt variant="data">Key −</Txt>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Up a semitone"
              onPress={() => view.step(1)}
              style={styles.keyButton}
            >
              <Txt variant="data">Key +</Txt>
            </Pressable>
          </View>
        </View>
      ) : null}

      {view.song.isPending ? <Loading /> : null}

      <GestureDetector gesture={swipe}>
        <View style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.body}>
            {section ? (
              <>
                <Txt variant="micro" style={{ color: t.ink2, fontSize: 14 }}>
                  {section.title ?? `Part ${index + 1}`} · {index + 1} of{" "}
                  {sections.length}
                </Txt>
                <ChordSheet
                  lines={section.lines}
                  size={size}
                  mode={mode}
                  palette={t}
                  sectionSpacing={0}
                />
                {upcoming ? (
                  <View style={[styles.next, { borderTopColor: t.hairline }]}>
                    <Txt variant="micro" style={{ color: t.ink2 }}>
                      Next: {upcoming.title ?? `Part ${index + 2}`}
                    </Txt>
                    <ChordSheet
                      lines={upcoming.lines.slice(0, 1)}
                      size={Math.round(size * 0.55)}
                      mode={mode}
                      palette={{ ...t, ink: t.ink2, chord: t.ink2 }}
                      sectionSpacing={0}
                    />
                  </View>
                ) : view.place.next ? (
                  <Txt
                    variant="micro"
                    style={{ color: t.ink2, marginTop: space.xl }}
                  >
                    Next song:{" "}
                    {
                      view.draft?.entries.find((e) => e.key === view.place.next)
                        ?.song.title
                    }
                  </Txt>
                ) : null}
              </>
            ) : view.song.data ? (
              <Txt variant="body" style={{ color: t.ink }}>
                This song has no chart yet.
              </Txt>
            ) : null}
          </ScrollView>
          {/* Tap the left edge to go back, the right edge to go forward. */}
          <View style={styles.taps} pointerEvents="box-none">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous section"
              onPress={back}
              style={styles.tap}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next section"
              onPress={forward}
              style={styles.tap}
            />
          </View>
        </View>
      </GestureDetector>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  tools: {
    gap: space.sm,
    padding: space.md,
    marginHorizontal: space.md,
    borderRadius: radius.md,
  },
  keys: { flexDirection: "row", gap: space.sm },
  keyButton: {
    minHeight: 40,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { padding: space.xl, gap: space.md, paddingBottom: space.xxl * 2 },
  next: {
    marginTop: space.xl,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space.xs,
    opacity: 0.8,
  },
  // Side strips only, so the middle still scrolls a long section.
  taps: {
    ...StyleSheet.absoluteFill,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  tap: { width: "26%" },
});
