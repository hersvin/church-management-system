import { publicLandingSchema } from "@cms/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPrismaMock, type PrismaMock } from "../test/prisma-mock";
import { PublicService } from "./public.service";

const NOW = new Date("2026-11-25T02:00:00Z");

describe("PublicService.landing", () => {
  let prisma: PrismaMock;
  let service: PublicService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new PublicService(prisma as never, { fetchXml: vi.fn() } as never);
    prisma.setting.findMany.mockResolvedValue([
      { key: "church.name", value: "Grace Community Church" },
      { key: "church.tagline", value: "A place to belong." },
      { key: "church.email", value: "hello@cms.local" },
      { key: "church.timezone", value: "Asia/Manila" },
    ]);
    prisma.branch.findMany.mockResolvedValue([
      {
        name: "Main Campus",
        address: "100 Grace Avenue",
        services: [{ name: "Sunday Worship 9 AM", startsAt: new Date("2026-11-29T01:00:00Z") }],
      },
    ]);
    prisma.ministry.findMany.mockResolvedValue([
      { name: "Worship Team", category: "WORSHIP", meetingSchedule: "Thursdays 7 PM", branch: { name: "Main Campus" } },
    ]);
    prisma.room.findMany.mockResolvedValue([
      {
        name: "Sanctuary",
        location: "Main building",
        capacity: 400,
        hourlyRate: { toString: () => "6000.00" },
        features: ["Piano"],
        branch: { name: "Main Campus" },
      },
    ]);
  });

  it("returns only public fields, in the shape the web validates", async () => {
    const result = await service.landing(NOW);
    expect(publicLandingSchema.parse(result)).toEqual(result);
    expect(result.church).toEqual({ name: "Grace Community Church", tagline: "A place to belong.", email: "hello@cms.local", phone: null });
    expect(result.campuses).toEqual([
      { name: "Main Campus", address: "100 Grace Avenue", services: [{ name: "Sunday Worship 9 AM", startsAt: "2026-11-29T01:00:00.000Z" }] },
    ]);
    expect(result.ministries).toEqual([
      { name: "Worship Team", category: "WORSHIP", meetingSchedule: "Thursdays 7 PM", branch: "Main Campus" },
    ]);
    expect(result.rooms).toEqual([
      { name: "Sanctuary", branch: "Main Campus", location: "Main building", capacity: 400, hourlyRate: 6000, features: ["Piano"] },
    ]);
  });

  it("reads church-wide settings, active branches, and the next week of services only", async () => {
    await service.landing(NOW);
    expect(prisma.setting.findMany.mock.calls[0][0].where).toEqual({ branchId: null, key: { startsWith: "church." } });
    const branchQuery = prisma.branch.findMany.mock.calls[0][0];
    expect(branchQuery.where).toEqual({ isActive: true });
    expect(branchQuery.select.services.where).toEqual({
      deletedAt: null,
      startsAt: { gte: NOW, lt: new Date("2026-12-02T02:00:00Z") },
    });
    expect(Object.keys(branchQuery.select)).toEqual(["name", "address", "services"]);
  });

  it("lists only active ministries and active rooms that have a rate", async () => {
    await service.landing(NOW);
    expect(prisma.ministry.findMany.mock.calls[0][0].where).toEqual({ deletedAt: null, isActive: true, branch: { isActive: true } });
    expect(prisma.room.findMany.mock.calls[0][0].where).toEqual({
      deletedAt: null,
      isActive: true,
      hourlyRate: { not: null },
      branch: { isActive: true },
    });
  });

  it("ignores settings that are not text", async () => {
    prisma.setting.findMany.mockResolvedValue([{ key: "church.name", value: { nested: true } }]);
    expect((await service.landing(NOW)).church.name).toBeNull();
  });
});

describe("PublicService.videos", () => {
  const CHANNEL = "UCcC2zfFwZ8WF4NhCk5yYs2g";
  const xml = (ids: string[]) =>
    `<feed>${ids.map((id, i) => `<entry><yt:videoId>${id}</yt:videoId><title>Video ${i}</title><published>2026-11-${String(20 - i).padStart(2, "0")}T00:00:00+00:00</published></entry>`).join("")}</feed>`;
  let prisma: PrismaMock;
  let feed: { fetchXml: ReturnType<typeof vi.fn> };
  let service: PublicService;
  const t0 = new Date("2026-11-25T02:00:00Z");

  beforeEach(() => {
    prisma = createPrismaMock();
    feed = { fetchXml: vi.fn().mockResolvedValue(xml(["AAAAAAAAAA1", "AAAAAAAAAA2", "AAAAAAAAAA3", "AAAAAAAAAA4", "AAAAAAAAAA5"])) };
    service = new PublicService(prisma as never, feed as never);
    prisma.setting.findFirst.mockResolvedValue({ value: CHANNEL });
  });

  it("returns the newest video and the next three from the channel set in Settings", async () => {
    const result = await service.videos(t0);
    expect(prisma.setting.findFirst.mock.calls[0][0].where).toEqual({ key: "youtube.channel_id", branchId: null });
    expect(feed.fetchXml).toHaveBeenCalledWith(CHANNEL);
    expect(result.channelUrl).toBe(`https://www.youtube.com/channel/${CHANNEL}`);
    expect(result.videos.map((v) => v.id)).toEqual(["AAAAAAAAAA1", "AAAAAAAAAA2", "AAAAAAAAAA3", "AAAAAAAAAA4"]);
  });

  it("returns no videos, and fetches nothing, when no valid channel is set", async () => {
    prisma.setting.findFirst.mockResolvedValue({ value: "https://evil.example/feed" });
    expect(await service.videos(t0)).toEqual({ channelUrl: null, videos: [] });
    prisma.setting.findFirst.mockResolvedValue(null);
    expect(await service.videos(t0)).toEqual({ channelUrl: null, videos: [] });
    expect(feed.fetchXml).not.toHaveBeenCalled();
  });

  it("caches the feed for 30 minutes", async () => {
    await service.videos(t0);
    await service.videos(new Date(t0.getTime() + 29 * 60_000));
    expect(feed.fetchXml).toHaveBeenCalledTimes(1);
    await service.videos(new Date(t0.getTime() + 31 * 60_000));
    expect(feed.fetchXml).toHaveBeenCalledTimes(2);
  });

  it("keeps showing the last good videos when YouTube fails", async () => {
    await service.videos(t0);
    feed.fetchXml.mockRejectedValue(new Error("down"));
    const later = await service.videos(new Date(t0.getTime() + 60 * 60_000));
    expect(later.videos).toHaveLength(4);
  });

  it("returns no videos when YouTube fails and nothing is cached", async () => {
    feed.fetchXml.mockRejectedValue(new Error("down"));
    expect((await service.videos(t0)).videos).toEqual([]);
  });
});
