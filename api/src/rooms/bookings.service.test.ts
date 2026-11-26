import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BRANCH_A, BRANCH_B, branchStaff, requester, roomManager, superAdmin } from "../test/actors";
import { createPrismaMock, type PrismaMock } from "../test/prisma-mock";
import { BookingsService } from "./bookings.service";

const ROOM = "22222222-2222-4222-8222-222222222222";
const BOOKING = "88888888-8888-4888-8888-888888888888";
const future = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000);

describe("BookingsService", () => {
  let prisma: PrismaMock;
  let audit: { record: ReturnType<typeof vi.fn> };
  let service: BookingsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    audit = { record: vi.fn() };
    service = new BookingsService(prisma as never, audit as never);
    prisma.room.findFirst.mockResolvedValue({ id: ROOM, branchId: BRANCH_A, isActive: true });
    prisma.roomBooking.findMany.mockResolvedValue([]);
    prisma.roomBooking.create.mockImplementation(async ({ data }) => ({ id: BOOKING, ...data }));
  });

  const input = () => ({ roomId: ROOM, startsAt: future(24), endsAt: future(26), purpose: "Choir practice" });

  describe("list", () => {
    it("returns bookings overlapping the window in scope, hiding cancelled and rejected by default", async () => {
      const from = new Date("2026-12-01T00:00:00Z");
      const to = new Date("2026-12-08T00:00:00Z");
      await service.list(branchStaff, { from, to, branchId: BRANCH_B });
      expect(prisma.roomBooking.findMany.mock.calls[0][0].where).toEqual({
        startsAt: { lt: to },
        endsAt: { gt: from },
        room: { deletedAt: null, branchId: BRANCH_A },
        status: { in: ["PENDING", "APPROVED"] },
      });
    });
  });

  describe("create", () => {
    it("creates a pending request for someone who cannot manage rooms", async () => {
      const booking = await service.create(requester, input());
      expect(booking.status).toBe("PENDING");
      expect(prisma.roomBooking.create.mock.calls[0][0].data).toMatchObject({ requestedById: requester.id, status: "PENDING" });
    });

    it("approves immediately for a room manager", async () => {
      await service.create(roomManager, input());
      expect(prisma.roomBooking.create.mock.calls[0][0].data).toMatchObject({
        status: "APPROVED",
        decidedById: roomManager.id,
        decidedAt: expect.any(Date),
      });
    });

    it("rejects a booking that starts in the past", async () => {
      await expect(service.create(roomManager, { ...input(), startsAt: future(-2), endsAt: future(-1) })).rejects.toThrow(
        BadRequestException,
      );
    });

    it("rejects an inactive room", async () => {
      prisma.room.findFirst.mockResolvedValue({ id: ROOM, branchId: BRANCH_A, isActive: false });
      await expect(service.create(roomManager, input())).rejects.toThrow(BadRequestException);
    });

    it("returns a conflict when an approved booking overlaps", async () => {
      const i = input();
      prisma.roomBooking.findMany.mockResolvedValue([
        { id: "b1", startsAt: i.startsAt, endsAt: i.endsAt, purpose: "Other", event: null },
      ]);
      await expect(service.create(requester, i)).rejects.toThrow(ConflictException);
      expect(prisma.roomBooking.create).not.toHaveBeenCalled();
    });

    it("turns a database overlap violation into a conflict", async () => {
      prisma.roomBooking.create.mockRejectedValue(new Error('violates exclusion constraint "RoomBooking_no_overlap"'));
      await expect(service.create(roomManager, input())).rejects.toThrow(ConflictException);
    });

    it("hides rooms outside the actor's branch", async () => {
      prisma.room.findFirst.mockResolvedValue(null);
      await expect(service.create(branchStaff, input())).rejects.toThrow(NotFoundException);
    });
  });

  describe("decisions", () => {
    const pending = () => ({
      id: BOOKING,
      roomId: ROOM,
      status: "PENDING",
      startsAt: future(24),
      endsAt: future(26),
      requestedById: requester.id,
      eventId: null,
      room: { branchId: BRANCH_A },
    });

    beforeEach(() => {
      prisma.roomBooking.findFirst.mockResolvedValue(pending());
      prisma.roomBooking.update.mockImplementation(async ({ data }) => ({ ...pending(), ...data }));
    });

    it("approves a pending request after re-checking conflicts, excluding itself", async () => {
      await service.approve(roomManager, BOOKING, { note: "Enjoy" });
      expect(prisma.roomBooking.findMany.mock.calls[0][0].where.id).toEqual({ notIn: [BOOKING] });
      expect(prisma.roomBooking.update.mock.calls[0][0].data).toMatchObject({
        status: "APPROVED",
        decisionNote: "Enjoy",
        decidedById: roomManager.id,
      });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "bookings.approve" }));
    });

    it("refuses to approve when something else was approved in the meantime", async () => {
      prisma.roomBooking.findMany.mockResolvedValue([
        { id: "b2", startsAt: pending().startsAt, endsAt: pending().endsAt, purpose: "Other", event: null },
      ]);
      await expect(service.approve(roomManager, BOOKING, {})).rejects.toThrow(ConflictException);
    });

    it("only decides pending requests", async () => {
      prisma.roomBooking.findFirst.mockResolvedValue({ ...pending(), status: "APPROVED" });
      await expect(service.reject(roomManager, BOOKING, {})).rejects.toThrow(BadRequestException);
    });

    it("rejects with a note", async () => {
      await service.reject(roomManager, BOOKING, { note: "Room is being painted" });
      expect(prisma.roomBooking.update.mock.calls[0][0].data).toMatchObject({ status: "REJECTED", decisionNote: "Room is being painted" });
    });

    it("lets the requester cancel their own request", async () => {
      await service.cancel(requester, BOOKING);
      expect(prisma.roomBooking.update.mock.calls[0][0].data).toEqual({ status: "CANCELLED" });
    });

    it("stops other people without rooms.manage from cancelling", async () => {
      await expect(service.cancel({ ...requester, id: "someone-else" }, BOOKING)).rejects.toThrow(ForbiddenException);
    });

    it("sends event bookings back to the event", async () => {
      prisma.roomBooking.findFirst.mockResolvedValue({ ...pending(), eventId: "e1" });
      await expect(service.cancel(superAdmin, BOOKING)).rejects.toThrow(BadRequestException);
    });
  });

  describe("pending", () => {
    it("lists upcoming pending requests in scope", async () => {
      await service.pending(branchStaff);
      const where = prisma.roomBooking.findMany.mock.calls[0][0].where;
      expect(where).toMatchObject({ status: "PENDING", room: { deletedAt: null, branchId: BRANCH_A } });
      expect(where.endsAt.gt).toBeInstanceOf(Date);
    });
  });
});
