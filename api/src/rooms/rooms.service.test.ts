import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BRANCH_A, BRANCH_B, branchStaff, superAdmin } from "../test/actors";
import { createPrismaMock, type PrismaMock } from "../test/prisma-mock";
import { Prisma } from "@cms/database";
import { RoomsService } from "./rooms.service";

const ROOM = "22222222-2222-4222-8222-222222222222";

describe("RoomsService", () => {
  let prisma: PrismaMock;
  let audit: { record: ReturnType<typeof vi.fn> };
  let service: RoomsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    audit = { record: vi.fn() };
    service = new RoomsService(prisma as never, audit as never);
  });

  it("lists rooms in scope with today's approved bookings", async () => {
    prisma.room.findMany.mockResolvedValue([]);
    prisma.room.count.mockResolvedValue(0);
    await service.list(branchStaff, { page: 1, pageSize: 20, search: "hall", branchId: BRANCH_B });
    const args = prisma.room.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ deletedAt: null, branchId: BRANCH_A, name: { contains: "hall", mode: "insensitive" } });
    expect(args.include.bookings.where.status).toBe("APPROVED");
  });

  it("returns hourly rates as numbers of pesos, or null when unset", async () => {
    prisma.room.findMany.mockResolvedValue([
      { id: ROOM, hourlyRate: new Prisma.Decimal("2500.50") },
      { id: "other", hourlyRate: null },
    ]);
    prisma.room.count.mockResolvedValue(2);
    const list = await service.list(superAdmin, { page: 1, pageSize: 20 });
    expect(list.items.map((r) => r.hourlyRate)).toEqual([2500.5, null]);

    prisma.room.findFirst.mockResolvedValue({ id: ROOM, branchId: BRANCH_A, hourlyRate: new Prisma.Decimal("6000") });
    expect((await service.get(superAdmin, ROOM)).hourlyRate).toBe(6000);

    prisma.room.update.mockResolvedValue({ id: ROOM, hourlyRate: new Prisma.Decimal("750") });
    expect((await service.update(superAdmin, ROOM, { hourlyRate: 750 })).hourlyRate).toBe(750);
    expect(prisma.room.update.mock.calls[0][0].data).toEqual({ hourlyRate: 750 });
  });

  it("throws NotFound outside scope", async () => {
    prisma.room.findFirst.mockResolvedValue(null);
    await expect(service.get(branchStaff, ROOM)).rejects.toThrow(NotFoundException);
  });

  it("forbids creating rooms in another branch", async () => {
    await expect(
      service.create(branchStaff, { name: "Hall", branchId: BRANCH_B, features: [] }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("creates and audits", async () => {
    prisma.room.create.mockResolvedValue({ id: ROOM });
    await service.create(superAdmin, { name: "Hall", branchId: BRANCH_A, features: ["Projector"] });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "rooms.create", entityId: ROOM }));
  });

  it("refuses to archive a room with upcoming approved bookings", async () => {
    prisma.room.findFirst.mockResolvedValue({ id: ROOM, branchId: BRANCH_A });
    prisma.roomBooking.count.mockResolvedValue(2);
    await expect(service.archive(superAdmin, ROOM)).rejects.toThrow(BadRequestException);
    expect(prisma.roomBooking.count.mock.calls[0][0].where).toMatchObject({ roomId: ROOM, status: "APPROVED" });
  });

  it("archives a room with no upcoming bookings and cancels pending requests", async () => {
    prisma.room.findFirst.mockResolvedValue({ id: ROOM, branchId: BRANCH_A });
    prisma.roomBooking.count.mockResolvedValue(0);
    prisma.roomBooking.updateMany.mockResolvedValue({ count: 1 });
    prisma.room.update.mockResolvedValue({});
    await service.archive(superAdmin, ROOM);
    expect(prisma.roomBooking.updateMany).toHaveBeenCalledWith({
      where: { roomId: ROOM, status: "PENDING" },
      data: { status: "CANCELLED" },
    });
    expect(prisma.room.update).toHaveBeenCalledWith({ where: { id: ROOM }, data: { deletedAt: expect.any(Date), isActive: false } });
  });
});
