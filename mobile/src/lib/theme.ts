/**
 * The admin app's e-ink paper look, for the phone: warm paper, black ink, hairlines, IBM Plex,
 * and one signal red used only for failures. State is shown with ink glyphs, never with hue.
 */
export const colors = {
  paper: "#f4f1ea",
  raised: "#faf8f3",
  sunk: "#ece8df",
  ink: "#141310",
  ink2: "#69675f",
  hairline: "#d6d3cc",
  signal: "#c8321e",
} as const;

export const fonts = {
  sans: "IBMPlexSans_400Regular",
  sansMedium: "IBMPlexSans_500Medium",
  sansBold: "IBMPlexSans_600SemiBold",
  mono: "IBMPlexMono_400Regular",
  monoMedium: "IBMPlexMono_500Medium",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 4, md: 8, lg: 12 } as const;
