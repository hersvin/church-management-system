export const FONT_MIN = 12;
export const FONT_MAX = 34;
export const clampFont = (size: number) =>
  Math.round(Math.min(FONT_MAX, Math.max(FONT_MIN, size)));

/** Reading themes for the song viewer and stage. Paper matches the app; dark is for dim stages. */
export const VIEWER_THEMES = {
  paper: {
    label: "Paper",
    paper: "#f4f1ea",
    raised: "#faf8f3",
    ink: "#141310",
    ink2: "#69675f",
    chord: "#141310",
    hairline: "#d6d3cc",
  },
  sepia: {
    label: "Sepia",
    paper: "#efe3cc",
    raised: "#f6ecd8",
    ink: "#2b2118",
    ink2: "#6e5f4d",
    chord: "#2b2118",
    hairline: "#d8c8aa",
  },
  dark: {
    label: "Dark",
    paper: "#0f0f0d",
    raised: "#1a1a17",
    ink: "#f1eee6",
    ink2: "#a19d92",
    chord: "#ffffff",
    hairline: "#33322d",
  },
} as const;
export type ViewerTheme = keyof typeof VIEWER_THEMES;

export type DisplayMode = "both" | "lyrics" | "chords";

/** Position in the setlist and the songs on either side, for previous and next. */
export function neighbours(
  list: readonly { key: string }[],
  key: string | undefined,
) {
  const index = list.findIndex((e) => e.key === key);
  if (index < 0)
    return { index: -1, count: list.length, previous: null, next: null };
  return {
    index,
    count: list.length,
    previous: list[index - 1]?.key ?? null,
    next: list[index + 1]?.key ?? null,
  };
}

/** Beats per minute from tap times in milliseconds. A gap over two seconds starts a new count. */
export function tapTempo(times: readonly number[]): number | null {
  let start = 0;
  for (let i = 1; i < times.length; i += 1)
    if (times[i] - times[i - 1] > 2000) start = i;
  const taps = times.slice(start);
  if (taps.length < 2) return null;
  const average = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
  return Math.round(60000 / average);
}

/** Viewer choices, kept while the app is open so every song opens the way the person left it. */
export const viewerPrefs: {
  theme: ViewerTheme;
  mode: DisplayMode;
  font: number;
} = { theme: "paper", mode: "both", font: 18 };
