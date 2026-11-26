import { useAudioPlayer } from "expo-audio";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useEffect, useRef, useState, type RefObject } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type ScrollViewInstance,
} from "react-native";
import { fonts, radius, space } from "../../lib/theme";
import { FONT_MAX, FONT_MIN, clampFont, tapTempo } from "../../lib/viewer";
import { Txt } from "../ui";

export interface Palette {
  paper: string;
  raised: string;
  ink: string;
  ink2: string;
  hairline: string;
}

/** Text size from FONT_MIN to FONT_MAX: drag along the track or tap A− and A+. */
export function FontSlider({
  value,
  onChange,
  palette,
}: {
  value: number;
  onChange: (v: number) => void;
  palette: Palette;
}) {
  const [width, setWidth] = useState(1);
  const pick = (x: number) =>
    onChange(
      clampFont(
        FONT_MIN +
          (Math.min(Math.max(x, 0), width) / width) * (FONT_MAX - FONT_MIN),
      ),
    );
  const share = (value - FONT_MIN) / (FONT_MAX - FONT_MIN);
  return (
    <View style={styles.sliderRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Smaller text"
        onPress={() => onChange(clampFont(value - 1))}
        style={[styles.step, { borderColor: palette.hairline }]}
      >
        <Txt variant="data" style={{ color: palette.ink }}>
          A−
        </Txt>
      </Pressable>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Text size"
        accessibilityValue={{ min: FONT_MIN, max: FONT_MAX, now: value }}
        onAccessibilityAction={(e) =>
          onChange(
            clampFont(
              value + (e.nativeEvent.actionName === "increment" ? 1 : -1),
            ),
          )
        }
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        style={styles.track}
        onLayout={(e: LayoutChangeEvent) =>
          setWidth(Math.max(1, e.nativeEvent.layout.width))
        }
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => pick(e.nativeEvent.locationX)}
        onResponderMove={(e) => pick(e.nativeEvent.locationX)}
      >
        <View style={[styles.rail, { backgroundColor: palette.hairline }]} />
        <View
          style={[
            styles.fill,
            { width: `${share * 100}%`, backgroundColor: palette.ink },
          ]}
        />
        <View
          style={[
            styles.thumb,
            {
              left: `${share * 100}%`,
              backgroundColor: palette.ink,
              borderColor: palette.paper,
            },
          ]}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Larger text"
        onPress={() => onChange(clampFont(value + 1))}
        style={[styles.step, { borderColor: palette.hairline }]}
      >
        <Txt variant="data" style={{ color: palette.ink, fontSize: 17 }}>
          A+
        </Txt>
      </Pressable>
      <Txt
        variant="data"
        style={{ color: palette.ink2, width: 40, textAlign: "right" }}
      >
        {value}px
      </Txt>
    </View>
  );
}

/** Keeps the screen on while `on` is true, for reading on a music stand. */
export function useStayAwake(on: boolean, tag: string) {
  useEffect(() => {
    if (!on) return;
    void activateKeepAwakeAsync(tag);
    return () => void deactivateKeepAwake(tag);
  }, [on, tag]);
}

/**
 * Scrolls a ScrollView smoothly at `speed` points per second. Touching the sheet pauses it, so a
 * player can drag back to a line; pressing play continues from there. Stops at the end.
 */
export function useAutoScroll(
  ref: RefObject<ScrollViewInstance | null>,
  speed: number,
) {
  const [playing, setPlaying] = useState(false);
  const y = useRef(0);
  const max = useRef(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) return;
    let last = Date.now();
    const tick = () => {
      const now = Date.now();
      y.current = Math.min(
        max.current,
        y.current + (speed * (now - last)) / 1000,
      );
      last = now;
      ref.current?.scrollTo({ y: y.current, animated: false });
      if (y.current >= max.current) {
        setPlaying(false);
        return;
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [playing, speed, ref]);

  useStayAwake(playing, "auto-scroll");

  return {
    playing,
    toggle: () => setPlaying((p) => !p),
    stop: () => setPlaying(false),
    /** Wire to the ScrollView so manual scrolling is respected. */
    scrollProps: {
      onScroll: (e: {
        nativeEvent: {
          contentOffset: { y: number };
          contentSize: { height: number };
          layoutMeasurement: { height: number };
        };
      }) => {
        const n = e.nativeEvent;
        max.current = Math.max(
          0,
          n.contentSize.height - n.layoutMeasurement.height,
        );
        if (!playing) y.current = n.contentOffset.y;
      },
      onScrollBeginDrag: () => setPlaying(false),
      onContentSizeChange: (_w: number, h: number) => {
        max.current = Math.max(max.current, h - 400);
      },
      scrollEventThrottle: 32,
    },
  };
}

const CLICK = require("../../../assets/sounds/click.wav");

/** A click track with a visual beat, 40 to 240 BPM, and tap tempo. */
export function Metronome({
  bpm: initial,
  palette,
}: {
  bpm: number | null;
  palette: Palette;
}) {
  const player = useAudioPlayer(CLICK);
  const [bpm, setBpm] = useState(initial ?? 72);
  const [on, setOn] = useState(false);
  const [beat, setBeat] = useState(0);
  const taps = useRef<number[]>([]);

  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => {
      player.seekTo(0);
      player.play();
      setBeat((b) => (b + 1) % 4);
    }, 60000 / bpm);
    return () => clearInterval(id);
  }, [on, bpm, player]);

  useStayAwake(on, "metronome");

  function tap() {
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < 8000), now].slice(
      -6,
    );
    const next = tapTempo(taps.current);
    if (next && next >= 40 && next <= 240) setBpm(next);
  }

  const change = (d: number) =>
    setBpm((b) => Math.min(240, Math.max(40, b + d)));
  return (
    <View
      style={[
        styles.metronome,
        { borderColor: palette.hairline, backgroundColor: palette.raised },
      ]}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={[
          styles.dot,
          {
            backgroundColor:
              on && beat === 0
                ? palette.ink
                : on
                  ? palette.ink2
                  : palette.hairline,
          },
        ]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={on ? "Stop metronome" : "Start metronome"}
        onPress={() => setOn((o) => !o)}
        style={[styles.step, { borderColor: palette.ink }]}
      >
        <Txt variant="data" style={{ color: palette.ink }}>
          {on ? "Stop" : "Click"}
        </Txt>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Slower"
        onPress={() => change(-2)}
        style={[styles.step, { borderColor: palette.hairline }]}
      >
        <Txt variant="data" style={{ color: palette.ink }}>
          −
        </Txt>
      </Pressable>
      <Txt
        variant="data"
        style={{ color: palette.ink, minWidth: 64, textAlign: "center" }}
        accessibilityLiveRegion="polite"
      >
        {bpm} BPM
      </Txt>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Faster"
        onPress={() => change(2)}
        style={[styles.step, { borderColor: palette.hairline }]}
      >
        <Txt variant="data" style={{ color: palette.ink }}>
          +
        </Txt>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tap tempo"
        onPress={tap}
        style={[
          styles.step,
          {
            borderColor: palette.hairline,
            paddingHorizontal: space.md,
            width: undefined,
          },
        ]}
      >
        <Txt variant="data" style={{ color: palette.ink }}>
          Tap
        </Txt>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sliderRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  step: {
    minWidth: 44,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  track: { flex: 1, height: 40, justifyContent: "center" },
  rail: { height: 2, borderRadius: 1 },
  fill: { position: "absolute", height: 2, left: 0 },
  thumb: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 11,
    marginLeft: -11,
    borderWidth: 2,
  },
  metronome: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: space.sm,
    padding: space.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 14, height: 14, borderRadius: 7, marginHorizontal: space.xs },
});

export const monoFont = fonts.mono;
