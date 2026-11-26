import { Fraunces, Host_Grotesk, IBM_Plex_Mono, IBM_Plex_Sans, Nunito, Playfair_Display, Space_Grotesk } from "next/font/google";
import type { FontKey } from "./design";

// Loaded only where the calendar image editor is used. The canvas needs each face's real family name.
const fraunces = Fraunces({ subsets: ["latin"], weight: ["500"], display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], weight: ["500"], display: "swap" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });
const hostGrotesk = Host_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });
const nunito = Nunito({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });
const plexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });

export const FONTS: Record<FontKey, { label: string; family: string; className: string }> = {
  fraunces: { label: "Fraunces", family: fraunces.style.fontFamily, className: fraunces.className },
  playfair: { label: "Playfair Display", family: playfair.style.fontFamily, className: playfair.className },
  spaceGrotesk: { label: "Space Grotesk", family: spaceGrotesk.style.fontFamily, className: spaceGrotesk.className },
  hostGrotesk: { label: "Host Grotesk", family: hostGrotesk.style.fontFamily, className: hostGrotesk.className },
  nunito: { label: "Nunito", family: nunito.style.fontFamily, className: nunito.className },
  plexSans: { label: "IBM Plex Sans", family: plexSans.style.fontFamily, className: plexSans.className },
  plexMono: { label: "IBM Plex Mono", family: plexMono.style.fontFamily, className: plexMono.className },
};
