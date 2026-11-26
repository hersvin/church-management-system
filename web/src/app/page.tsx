import { publicLandingSchema, publicVideosSchema, type PublicLanding, type PublicVideos } from "@cms/shared";
import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { Host_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { LANDING } from "@/features/landing/content";
import { LandingPage } from "@/features/landing/landing-page";
import { mergeLanding } from "@/features/landing/live";

// Landing-only faces: Host Grotesk for display lines, IBM Plex Mono for reading text.
// The admin app keeps Inter and Plus Jakarta Sans from the root layout.
const hostGrotesk = Host_Grotesk({
  variable: "--font-host-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { absolute: LANDING.church.name },
  description: `${LANDING.hero.title} Sunday services at three campuses in Springfield.`,
};

const API_URL = process.env.API_URL ?? "http://localhost:4000";

/**
 * Live church data from the public API, refreshed every few minutes. Any failure (API down,
 * slow, or an unexpected shape) returns null and the page keeps its written copy.
 */
async function loadLiveLanding(): Promise<PublicLanding | null> {
  "use cache";
  cacheLife("minutes");
  try {
    const response = await fetch(`${API_URL}/public/landing`, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return null;
    const parsed = publicLandingSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Newest videos from the church's YouTube channel; none if the API is down or no channel is set. */
async function loadVideos(): Promise<PublicVideos> {
  "use cache";
  cacheLife("minutes");
  try {
    const response = await fetch(`${API_URL}/public/videos`, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) return { channelUrl: null, videos: [] };
    const parsed = publicVideosSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : { channelUrl: null, videos: [] };
  } catch {
    return { channelUrl: null, videos: [] };
  }
}

// Public landing page: written copy with live campuses, service times, ministries, and room rates.
export default async function HomePage() {
  const [live, videos] = await Promise.all([loadLiveLanding(), loadVideos()]);
  const content = mergeLanding(LANDING, live);
  return (
    <div className={`${hostGrotesk.variable} ${plexMono.variable} flex flex-1 flex-col`}>
      <LandingPage content={content} videos={videos} />
    </div>
  );
}
