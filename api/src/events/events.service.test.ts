import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BRANCH_A, BRANCH_B, branchStaff, requester, roomManager } from "../test/actors";
import { createPrismaMock, type PrismaMock } from "../test/prisma-mock";
import { EventsService } from "./events.service";

const ROOM = "22222222-2222-4222-8222-222222222222";
const EVENT = "99999999-9999-4999-8999-999999999999";
const MEMBER = "55555555-5555-4555-8555-555555555555";
const MINISTRY = "44444444-4444-4444-8444-444444444444";
const at = (iso: string) => new Date(iso);

describe("EventsService", () => {
  let prisma: PrismaMock;
  let audit: { record: ReturnType<typeof vi.fn> };
  let service: EventsService;
  let created: Record<string, unknown>[];

  beforeEach(() => {
    prisma = createPrismaMock();
    audit = { record: vi.fn() };
    service = new EventsService(prisma as never, audit as never);
    created = [];
    prisma.room.findFirst.mockResolvedValue({ id: ROOM, branchId: BRANCH_A, isActive: true });
    prisma.ministry.findFirst.mockResolvedValue({ id: MINISTRY, branchId: BRANCH_A });
    prisma.roomBooking.findMany.mockResolvedValue([]);
    prisma.event.create.mockImplementation(async ({ data }) => {
      const row = { id: `e${created.length + 1}`, ...data };
      created.push(row);
      return row;
    });
  });

  const base = {
    title: "Sunday Worship",
    category: "SERVICE" as const,
    startsAt: at("2026-12-06T01:00:00Z"),
    endsAt: at("2026-12-06T02:30:00Z"),
    branchId: BRANCH_A,
    registrationRequired: false,
  };

  describe("list", () => {
    it("returns scheduled events overlapping the window in scope", async () => {
      prisma.event.findMany.mockResolvedValue([]);
      const from = at("2026-12-01T00:00:00Z");
      const to = at("2027-01-01T00:00:00Z");
      await service.list(branchStaff, { from, to, branchId: BRANCH_B, category: "SERVICE" });
      expect(prisma.event.findMany.mock.calls[0][0].where).toEqual({
        branchId: BRANCH_A,
        startsAt: { lt: to },
        endsAt: { gt: from },
        status: "SCHEDULED",
        category: "SERVICE",
      });
    });
  });

  describe("create", () => {
    it("creates one event without a series id", async () => {
      const result = await service.create(roomManager, base);
      expect(result.count).toBe(1);
      expect(created[0].seriesId).toBeUndefined();
    });

    it("creates a weekly series sharing one series id", async () => {
      const result = await service.create(roomManager, {
        ...base,
        repeat: { frequency: "WEEKLY", until: at("2026-12-27T00:00:00Z") },
      });
      expect(result.count).toBe(4);
      const ids = new Set(created.map((e) => e.seriesId));
      expect(ids.size).toBe(1);
      expect([...ids][0]).toMatch(/^[0-9a-f-]{36}$/);
    });

    it("books the room for each occurrence, approved for a room manager", async () => {
      await service.create(roomManager, { ...base, roomId: ROOM, repeat: { frequency: "WEEKLY", until: at("2026-12-13T00:00:00Z") } });
      expect(created).toHaveLength(2);
      for (const e of created) {
        expect(e.booking).toEqual({
          create: expect.objectContaining({ roomId: ROOM, status: "APPROVED", purpose: "Sunday Worship", decidedById: roomManager.id }),
        });
      }
    });

    it("leaves the room booking pending for someone who cannot manage rooms", async () => {
      await service.create(requester, { ...base, roomId: ROOM });
      expect((created[0].booking as { create: { status: string } }).create.status).toBe("PENDING");
    });

    it("creates nothing when any occurrence clashes", async () => {
      prisma.roomBooking.findMany.mockResolvedValue([
        { id: "b1", startsAt: at("2026-12-13T01:00:00Z"), endsAt: at("2026-12-13T03:00:00Z"), purpose: "Wedding", event: null },
      ]);
      await expect(
        service.create(roomManager, { ...base, roomId: ROOM, repeat: { frequency: "WEEKLY", until: at("2026-12-20T00:00:00Z") } }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.event.create).not.toHaveBeenCalled();
    });

    it("rejects a room from another branch", async () => {
      prisma.room.findFirst.mockResolvedValue({ id: ROOM, branchId: BRANCH_B, isActive: true });
      await expect(service.create(roomManager, { ...base, roomId: ROOM })).rejects.toThrow(BadRequestException);
    });

    it("rejects a ministry from another branch", async () => {
      prisma.ministry.findFirst.mockResolvedValue({ id: MINISTRY, branchId: BRANCH_B });
      await expect(service.create(roomManager, { ...base, ministryId: MINISTRY })).rejects.toThrow(BadRequestException);
    });

    it("requires rooms.book to attach a room", async () => {
      const noBooking = { ...requester, permissions: ["events.read", "events.manage"] };
      await expect(service.create(noBooking, { ...base, roomId: ROOM })).rejects.toThrow(ForbiddenException);
      await expect(service.update(noBooking, EVENT, { roomId: ROOM })).rejects.toThrow(ForbiddenException);
    });

    it("forbids creating in another branch", async () => {
      await expect(service.create(branchStaff, { ...base, branchId: BRANCH_B })).rejects.toThrow(ForbiddenException);
    });
  });

  describe("update", () => {
    const existing = () => ({
      id: EVENT,
      title: "Choir",
      branchId: BRANCH_A,
      status: "SCHEDULED",
      startsAt: at("2026-12-06T01:00:00Z"),
      endsAt: at("2026-12-06T02:00:00Z"),
      roomId: ROOM,
      capacity: null,
      booking: { id: "bk1", roomId: ROOM, status: "APPROVED" },
    });

    beforeEach(() => {
      prisma.event.findFirst.mockResolvedValue(existing());
      prisma.event.update.mockImplementation(async ({ data }) => ({ ...existing(), ...data }));
      prisma.roomBooking.update.mockResolvedValue({});
      prisma.roomBooking.create.mockResolvedValue({});
    });

    it("moves the booking with the event and re-checks conflicts excluding itself", async () => {
      await service.update(roomManager, EVENT, { startsAt: at("2026-12-06T03:00:00Z"), endsAt: at("2026-12-06T04:00:00Z") });
      expect(prisma.roomBooking.findMany.mock.calls[0][0].where.id).toEqual({ notIn: ["bk1"] });
      expect(prisma.roomBooking.update).toHaveBeenCalledWith({
        where: { id: "bk1" },
        data: expect.objectContaining({ startsAt: at("2026-12-06T03:00:00Z"), endsAt: at("2026-12-06T04:00:00Z"), status: "APPROVED" }),
      });
    });

    it("needs re-approval when someone without rooms.manage changes the time", async () => {
      await service.update(requester, EVENT, { startsAt: at("2026-12-06T03:00:00Z"), endsAt: at("2026-12-06T04:00:00Z") });
      expect(prisma.roomBooking.update.mock.calls[0][0].data.status).toBe("PENDING");
    });

    it("cancels the booking when the room is removed", async () => {
      await service.update(roomManager, EVENT, { roomId: null });
      expect(prisma.roomBooking.update).toHaveBeenCalledWith({ where: { id: "bk1" }, data: { status: "CANCELLED" } });
    });

    it("rejects an end before the existing start", async () => {
      await expect(service.update(roomManager, EVENT, { endsAt: at("2026-12-06T00:30:00Z") })).rejects.toThrow(BadRequestException);
    });

    it("does not lower capacity below current registrations", async () => {
      prisma.eventRegistration.count.mockResolvedValue(30);
      await expect(service.update(roomManager, EVENT, { capacity: 20 })).rejects.toThrow(BadRequestException);
    });

    it("refuses to edit a cancelled event", async () => {
      prisma.event.findFirst.mockResolvedValue({ ...existing(), status: "CANCELLED" });
      await expect(service.update(roomManager, EVENT, { title: "X" })).rejects.toThrow(BadRequestException);
    });
  });

  describe("cancel", () => {
    beforeEach(() => {
      prisma.event.findFirst.mockResolvedValue({
        id: EVENT,
        branchId: BRANCH_A,
        status: "SCHEDULED",
        seriesId: "s1",
        startsAt: at("2026-12-13T01:00:00Z"),
      });
      prisma.event.findMany.mockResolvedValue([{ id: EVENT }, { id: "e2" }, { id: "e3" }]);
      prisma.event.updateMany.mockResolvedValue({ count: 3 });
      prisma.roomBooking.updateMany.mockResolvedValue({ count: 3 });
    });

    it("cancels only this occurrence by default", async () => {
      const result = await service.cancel(roomManager, EVENT, { scope: "THIS", reason: "Typhoon" });
      expect(prisma.event.updateMany.mock.calls[0][0]).toEqual({
        where: { id: { in: [EVENT] } },
        data: { status: "CANCELLED", cancelReason: "Typhoon" },
      });
      expect(prisma.roomBooking.updateMany.mock.calls[0][0]).toEqual({
        where: { eventId: { in: [EVENT] }, status: { in: ["PENDING", "APPROVED"] } },
        data: { status: "CANCELLED" },
      });
      expect(result.cancelled).toBe(1);
    });

    it("cancels this and following occurrences in the series", async () => {
      const result = await service.cancel(roomManager, EVENT, { scope: "FOLLOWING" });
      expect(prisma.event.findMany.mock.calls[0][0].where).toEqual({
        seriesId: "s1",
        startsAt: { gte: at("2026-12-13T01:00:00Z") },
        status: "SCHEDULED",
      });
      expect(result.cancelled).toBe(3);
    });
  });

  describe("registrations", () => {
    const event = (over: Record<string, unknown> = {}) => ({
      id: EVENT,
      branchId: BRANCH_A,
      status: "SCHEDULED",
      registrationRequired: true,
      capacity: 2,
      endsAt: new Date(Date.now() + 86400000),
      ...over,
    });

    beforeEach(() => {
      prisma.event.findFirst.mockResolvedValue(event());
      prisma.eventRegistration.count.mockResolvedValue(0);
      prisma.eventRegistration.findFirst.mockResolvedValue(null);
      prisma.member.findFirst.mockResolvedValue({ id: MEMBER, branchId: BRANCH_A });
      prisma.eventRegistration.create.mockImplementation(async ({ data }) => ({ id: "r1", ...data }));
    });

    it("registers a member", async () => {
      await service.register(roomManager, EVENT, { memberId: MEMBER });
      expect(prisma.eventRegistration.create.mock.calls[0][0].data).toMatchObject({ eventId: EVENT, memberId: MEMBER });
    });

    it("registers a guest", async () => {
      await service.register(roomManager, EVENT, { guestName: "Jo Smith" });
      expect(prisma.eventRegistration.create.mock.calls[0][0].data).toMatchObject({ guestName: "Jo Smith" });
    });

    it("refuses when the event is full", async () => {
      prisma.eventRegistration.count.mockResolvedValue(2);
      await expect(service.register(roomManager, EVENT, { guestName: "Jo" })).rejects.toThrow(ConflictException);
    });

    it("refuses a duplicate member registration", async () => {
      prisma.eventRegistration.findFirst.mockResolvedValue({ id: "r0" });
      await expect(service.register(roomManager, EVENT, { memberId: MEMBER })).rejects.toThrow(ConflictException);
    });

    it("refuses when registration is not enabled", async () => {
      prisma.event.findFirst.mockResolvedValue(event({ registrationRequired: false }));
      await expect(service.register(roomManager, EVENT, { guestName: "Jo" })).rejects.toThrow(BadRequestException);
    });

    it("refuses a past or cancelled event", async () => {
      prisma.event.findFirst.mockResolvedValue(event({ status: "CANCELLED" }));
      await expect(service.register(roomManager, EVENT, { guestName: "Jo" })).rejects.toThrow(BadRequestException);
    });

    it("cancels a registration by setting cancelledAt", async () => {
      prisma.eventRegistration.findFirst.mockResolvedValue({ id: "r1", eventId: EVENT, cancelledAt: null });
      prisma.eventRegistration.update.mockResolvedValue({});
      await service.cancelRegistration(roomManager, EVENT, "r1");
      expect(prisma.eventRegistration.update).toHaveBeenCalledWith({ where: { id: "r1" }, data: { cancelledAt: expect.any(Date) } });
    });

    it("throws NotFound for an unknown registration", async () => {
      prisma.eventRegistration.findFirst.mockResolvedValue(null);
      await expect(service.cancelRegistration(roomManager, EVENT, "r9")).rejects.toThrow(NotFoundException);
    });
  });
});
