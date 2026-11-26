/** Editable look of the calendar image: style presets, palettes, fonts, sizes, and toggles. */

export type StyleKey = "colorful" | "ink" | "bold" | "minimal";
export type FontKey = "fraunces" | "playfair" | "spaceGrotesk" | "hostGrotesk" | "nunito" | "plexSans" | "plexMono";
export type LayoutKey = "grid" | "list" | "week";
export type SizeKey =
  | "square"
  | "portrait"
  | "story"
  | "facebook"
  | "x"
  | "landscape"
  | "standard"
  | "a4"
  | "a4Landscape"
  | "letter"
  | "bulletin";

export interface Colors {
  background: string;
  header: string;
  accent: string;
  text: string;
}

export interface Design {
  style: StyleKey;
  colors: Colors;
  headingFont: FontKey;
  bodyFont: FontKey;
  layout: LayoutKey;
  /** Week shown by the week layout, 0-based. */
  week: number;
  size: SizeKey;
  weekStart: 0 | 1;
  showTimes: boolean;
  showRooms: boolean;
  showFooter: boolean;
  title: string;
  subtitle: string;
  footer: string;
}

export const STYLE_PRESETS: Record<StyleKey, { label: string; colors: Colors; headingFont: FontKey; bodyFont: FontKey }> = {
  colorful: {
    label: "Colorful",
    colors: { background: "#FFF4E6", header: "#E8590C", accent: "#7048E8", text: "#2B2118" },
    headingFont: "fraunces",
    bodyFont: "nunito",
  },
  ink: {
    label: "Paper ink",
    colors: { background: "#F4F1EA", header: "#141310", accent: "#141310", text: "#141310" },
    headingFont: "plexSans",
    bodyFont: "plexMono",
  },
  bold: {
    label: "Bold",
    colors: { background: "#141310", header: "#FFD43B", accent: "#FFD43B", text: "#F8F9FA" },
    headingFont: "spaceGrotesk",
    bodyFont: "spaceGrotesk",
  },
  minimal: {
    label: "Minimal",
    colors: { background: "#FFFFFF", header: "#FFFFFF", accent: "#495057", text: "#212529" },
    headingFont: "hostGrotesk",
    bodyFont: "hostGrotesk",
  },
};

export const PALETTES: Record<string, Colors> = {
  Sunrise: STYLE_PRESETS.colorful.colors,
  Lagoon: { background: "#E6FCF5", header: "#0C8599", accent: "#F76707", text: "#0B2E33" },
  Berry: { background: "#FFF0F6", header: "#A61E4D", accent: "#1971C2", text: "#2E0F1C" },
  Forest: { background: "#F4FCE3", header: "#2B8A3E", accent: "#E67700", text: "#14260F" },
};

/** Chip colors per event category for the colorful style. */
export const CATEGORY_COLORS: Record<string, string> = {
  // Each passes 4.5:1 with white text.
  SERVICE: "#C2410C",
  MEETING: "#1971C2",
  CLASS: "#0B7285",
  OUTREACH: "#237032",
  FELLOWSHIP: "#C2255C",
  CONFERENCE: "#7048E8",
  OTHER: "#495057",
};

/** Suggested image sizes in pixels. Print sizes are at 150 dots per inch. */
export const SIZES: Record<SizeKey, { label: string; width: number; height: number }> = {
  square: { label: "Square post 1080 x 1080", width: 1080, height: 1080 },
  portrait: { label: "Portrait post 1080 x 1350", width: 1080, height: 1350 },
  story: { label: "Story 1080 x 1920", width: 1080, height: 1920 },
  facebook: { label: "Facebook post 1200 x 630", width: 1200, height: 630 },
  x: { label: "X post 1600 x 900", width: 1600, height: 900 },
  landscape: { label: "Landscape 16:9, 1920 x 1080", width: 1920, height: 1080 },
  standard: { label: "Projector 4:3, 1440 x 1080", width: 1440, height: 1080 },
  a4: { label: "A4 portrait", width: 1240, height: 1754 },
  a4Landscape: { label: "A4 landscape", width: 1754, height: 1240 },
  letter: { label: "US Letter portrait", width: 1275, height: 1650 },
  bulletin: { label: "Bulletin insert 5.5 x 8.5 in", width: 825, height: 1275 },
};

export const SIZE_GROUPS: { label: string; sizes: SizeKey[] }[] = [
  { label: "Social", sizes: ["square", "portrait", "story", "facebook", "x"] },
  { label: "Screens", sizes: ["landscape", "standard"] },
  { label: "Print", sizes: ["a4", "a4Landscape", "letter", "bulletin"] },
];

/** Drawing scale: the shorter side over 1080, so text and the header stay in proportion on wide images. */
export const posterScale = (size: { width: number; height: number }) => Math.min(size.width, size.height) / 1080;

export const LAYOUTS: { key: LayoutKey; label: string }[] = [
  { key: "grid", label: "Month grid" },
  { key: "list", label: "List" },
  { key: "week", label: "Week" },
];

export function defaultDesign(words: { title: string; subtitle: string; footer: string }): Design {
  const preset = STYLE_PRESETS.colorful;
  return {
    style: "colorful",
    colors: preset.colors,
    headingFont: preset.headingFont,
    bodyFont: preset.bodyFont,
    layout: "grid",
    week: 0,
    size: "square",
    weekStart: 0,
    showTimes: true,
    showRooms: false,
    showFooter: true,
    ...words,
  };
}

export const withStyle = (d: Design, style: StyleKey): Design => {
  const p = STYLE_PRESETS[style];
  return { ...d, style, colors: p.colors, headingFont: p.headingFont, bodyFont: p.bodyFont };
};

export const withPalette = (d: Design, name: string): Design => ({ ...d, colors: PALETTES[name] ?? d.colors });

/**
 * White when it meets WCAG contrast on `hex` (4.5:1, or 3:1 for large text such as the title), else ink.
 */
export function readableOn(hex: string, large = false): "#ffffff" | "#141310" {
  const n = parseInt(hex.replace("#", ""), 16);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
  return 1.05 / (lum + 0.05) >= (large ? 3 : 4.5) ? "#ffffff" : "#141310";
}
