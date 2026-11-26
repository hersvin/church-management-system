import { z } from "zod";
import { MINISTRY_CATEGORIES } from "./ministries";

/** How many days ahead the public site lists services. */
export const PUBLIC_SERVICE_DAYS = 7;

const text = z.string().nullable();

/**
 * Everything the public landing page shows from the database. No personal data:
 * branch addresses, service names and times, ministry names, room names and rates only.
 * The web validates the API response against this schema before using it.
 */
export const publicLandingSchema = z.object({
  church: z.object({ name: text, tagline: text, email: text, phone: text }),
  campuses: z.array(
    z.object({
      name: z.string(),
      address: text,
      services: z.array(z.object({ name: z.string(), startsAt: z.iso.datetime() })),
    }),
  ),
  ministries: z.array(
    z.object({ name: z.string(), category: z.enum(MINISTRY_CATEGORIES), meetingSchedule: text, branch: z.string() }),
  ),
  rooms: z.array(
    z.object({
      name: z.string(),
      branch: z.string(),
      location: text,
      capacity: z.number().int().nullable(),
      hourlyRate: z.number().min(0),
      features: z.array(z.string()),
    }),
  ),
});
export type PublicLanding = z.infer<typeof publicLandingSchema>;

// ---------- Videos ----------

/** Settings key holding the church's YouTube channel ID (starts with "UC"). */
export const YOUTUBE_CHANNEL_SETTING = "youtube.channel_id";
export const youtubeChannelIdSchema = z.string().regex(/^UC[A-Za-z0-9_-]{22}$/, "Use the channel ID that starts with UC");
export const youtubeVideoIdSchema = z.string().regex(/^[A-Za-z0-9_-]{11}$/);

/** The featured (newest) video first, then the next most recent ones. */
export const publicVideosSchema = z.object({
  channelUrl: z.url().nullable(),
  videos: z.array(
    z.object({
      id: youtubeVideoIdSchema,
      title: z.string(),
      publishedAt: z.iso.datetime({ offset: true }),
      thumbnail: z.url(),
    }),
  ),
});
export type PublicVideos = z.infer<typeof publicVideosSchema>;
export type PublicVideo = PublicVideos["videos"][number];
