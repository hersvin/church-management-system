import type { ChartLine } from "@cms/shared";
import { StyleSheet, View } from "react-native";
import { chunkLine, type ChartChunk } from "../../lib/chart-layout";
import { colors, fonts, space } from "../../lib/theme";
import type { DisplayMode } from "../../lib/viewer";
import { Txt } from "../ui";

/** Pieces joined mid-word stay together so the line only wraps between words. */
function groups(chunks: ChartChunk[]): ChartChunk[][] {
  const out: ChartChunk[][] = [];
  let current: ChartChunk[] = [];
  for (const chunk of chunks) {
    current.push(chunk);
    if (!chunk.joined) {
      out.push(current);
      current = [];
    }
  }
  if (current.length) out.push(current);
  return out;
}

export interface SheetColors {
  ink: string;
  ink2: string;
  chord: string;
}

const PAPER: SheetColors = {
  ink: colors.ink,
  ink2: colors.ink2,
  chord: colors.ink,
};

/**
 * Lyrics with each chord printed above the syllable where it is played, in mono ink.
 * "lyrics" hides the chords (for singers), "chords" shows only the chord line (for the band).
 */
export function ChordSheet({
  lines,
  size,
  mode = "both",
  palette = PAPER,
  sectionSpacing = space.md,
}: {
  lines: ChartLine[];
  size: number;
  mode?: DisplayMode;
  palette?: SheetColors;
  sectionSpacing?: number;
}) {
  const lyric = {
    fontSize: size,
    lineHeight: Math.round(size * 1.35),
    color: palette.ink,
  };
  const chord = {
    fontSize: Math.round(size * 0.9),
    lineHeight: Math.round(size * 1.2),
    color: palette.chord,
  };
  return (
    <View style={{ gap: space.xs }}>
      {lines.map((line, i) => {
        if (line.kind === "blank")
          return <View key={i} style={{ height: Math.round(size * 0.8) }} />;
        if (line.kind === "section") {
          return (
            <Txt
              key={i}
              variant="micro"
              style={[
                styles.section,
                {
                  marginTop: sectionSpacing,
                  color: palette.ink2,
                  fontSize: Math.max(11, size * 0.7),
                },
              ]}
            >
              {line.text}
            </Txt>
          );
        }
        const chords = line.segments
          .filter((s) => s.chord)
          .map((s) => s.chord as string);
        if (mode === "chords") {
          return chords.length ? (
            <Txt key={i} style={[styles.chord, chord]}>
              {chords.join("   ")}
            </Txt>
          ) : null;
        }
        if (mode === "lyrics") {
          const text = line.segments.map((s) => s.text).join("");
          return text.trim() ? (
            <Txt key={i} style={[styles.lyric, lyric]}>
              {text}
            </Txt>
          ) : null;
        }
        const hasChords = chords.length > 0;
        return (
          <View key={i} style={styles.line}>
            {groups(chunkLine(line.segments)).map((group, g) => (
              <View key={g} style={styles.group}>
                {group.map((piece, p) => (
                  <View key={p}>
                    {hasChords ? (
                      <Txt style={[styles.chord, chord]}>
                        {piece.chord ? `${piece.chord} ` : " "}
                      </Txt>
                    ) : null}
                    <Txt style={[styles.lyric, lyric]}>{piece.text || " "}</Txt>
                  </View>
                ))}
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: "row", flexWrap: "wrap" },
  group: { flexDirection: "row" },
  chord: { fontFamily: fonts.monoMedium },
  lyric: { fontFamily: fonts.sans },
  section: { letterSpacing: 1 },
});
