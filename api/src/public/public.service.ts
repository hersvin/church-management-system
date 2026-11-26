import { Injectable, Logger } from "@nestjs/common";
import { PUBLIC_SERVICE_DAYS, YOUTUBE_CHANNEL_SETTING, youtubeChannelIdSchema, type PublicLanding, type PublicVideos } from "@cms/shared";
import { PrismaService } from "../prisma/prisma.service";
import { parseYoutubeFeed, YoutubeFeed } from "./youtube";

const DAY_MS = 24 * 60 * 60 * 1000;
const CHURCH_KEYS = ["name", "tagline", "email", "phone"] as const;
/** How long a fetched YouTube feed is reused, and how many videos the site shows (featured plus three). */
const FEED_TTL_MS = 30 * 60 * 1000;
const VIDEO_COUNT = 4;

/** Read-only data for the public site. Selects public fields only; never members, users, or contacts of people. */
@Injectable()
export class PublicService {
  private readonly logger = new Logger(PublicService.name);
  private feedCache = new Map<string, { at: number; videos: PublicVideos["videos"] }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly youtube: YoutubeFeed,
  ) {}

  /**
   * The newest video on the church's YouTube channel (set in Settings as `youtube.channel_id`) and the
   * next three. The feed is cached for 30 minutes; if YouTube fails, the last good list is kept.
   */
  async videos(now = new Date()): Promise<PublicVideos> {
    const setting = await this.prisma.setting.findFirst({ where: { key: YOUTUBE_CHANNEL_SETTING, branchId: null }, select: { value: true } });
    const channel = youtubeChannelIdSchema.safeParse(setting?.value);
    if (!channel.success) return { channelUrl: null, videos: [] };
    const channelId = channel.data;
    const cached = this.feedCache.get(channelId);
    let videos = cached?.videos ?? [];
    if (!cached || now.getTime() - cached.at >= FEED_TTL_MS) {
      try {
        videos = parseYoutubeFeed(await this.youtube.fetchXml(channelId), VIDEO_COUNT);
        this.feedCache.set(channelId, { at: now.getTime(), videos });
      } catch (error) {
        // Keep the last good list (or none) rather than failing the public page.
        const reason = error instanceof Error ? ((error.cause as { code?: string } | undefined)?.code ?? error.message) : "unknown error";
        this.logger.warn(`YouTube feed unavailable (${reason}); showing ${videos.length} cached videos`);
      }
    }
    return { channelUrl: `https://www.youtube.com/channel/${channelId}`, videos };
  }

  async landing(now = new Date()): Promise<PublicLanding> {
    const until = new Date(now.getTime() + PUBLIC_SERVICE_DAYS * DAY_MS);
    const activeBranch = { branch: { isActive: true } };
    const [settings, branches, ministries, rooms] = await Promise.all([
      this.prisma.setting.findMany({
        where: { branchId: null, key: { startsWith: "church." } },
        select: { key: true, value: true },
      }),
      this.prisma.branch.findMany({
        where: { isActive: true },
        select: {
          name: true,
          address: true,
          services: {
            where: { deletedAt: null, startsAt: { gte: now, lt: until } },
            select: { name: true, startsAt: true },
            orderBy: { startsAt: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.ministry.findMany({
        where: { deletedAt: null, isActive: true, ...activeBranch },
        select: { name: true, category: true, meetingSchedule: true, branch: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.room.findMany({
        where: { deletedAt: null, isActive: true, hourlyRate: { not: null }, ...activeBranch },
        select: { name: true, location: true, capacity: true, hourlyRate: true, features: true, branch: { select: { name: true } } },
        orderBy: { hourlyRate: "asc" },
      }),
    ]);

    const setting = new Map(settings.map((s) => [s.key, s.value]));
    const textSetting = (key: string) => {
      const value = setting.get(`church.${key}`);
      return typeof value === "string" ? value : null;
    };

    return {
      church: Object.fromEntries(CHURCH_KEYS.map((k) => [k, textSetting(k)])) as PublicLanding["church"],
      campuses: branches.map((b) => ({
        name: b.name,
        address: b.address,
        services: b.services.map((s) => ({ name: s.name, startsAt: s.startsAt.toISOString() })),
      })),
      ministries: ministries.map((m) => ({
        name: m.name,
        category: m.category,
        meetingSchedule: m.meetingSchedule,
        branch: m.branch.name,
      })),
      rooms: rooms.map((r) => ({
        name: r.name,
        branch: r.branch.name,
        location: r.location,
        capacity: r.capacity,
        hourlyRate: Number(r.hourlyRate!.toString()),
        features: r.features,
      })),
    };
  }
}
