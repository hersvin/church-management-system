import { ConflictException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { createPrismaMock } from "../test/prisma-mock";
import { assertRoomAvailable, isOverlapViolation } from "./availability";

const ROOM = "22222222-2222-4222-8222-222222222222";
const at = (iso: string) => new Date(iso);

describe("assertRoomAvailable", () => {
  const ranges = [
    { startsAt: at("2026-12-06T09:00:00Z"), endsAt: at("2026-12-06T10:00:00Z") },
    { startsAt: at("2026-12-13T09:00:00Z"), endsAt: at("2026-12-13T10:00:00Z") },
  ];

  it("queries approved bookings in the overall window, excluding given ids", async () => {
    const prisma = createPrismaMock();
    prisma.roomBooking.findMany.mockResolvedValue([]);
    await assertRoomAvailable(prisma as never, ROOM, ranges, ["b9"]);
    expect(prisma.roomBooking.findMany.mock.calls[0][0].where).toEqual({
      roomId: ROOM,
      status: "APPROVED",
      startsAt: { lt: ranges[1].endsAt },
      endsAt: { gt: ranges[0].startsAt },
      id: { notIn: ["b9"] },
    });
  });

  it("passes when nothing overlaps", async () => {
    const prisma = createPrismaMock();
    prisma.roomBooking.findMany.mockResolvedValue([
      { id: "b1", startsAt: at("2026-12-06T10:00:00Z"), endsAt: at("2026-12-06T11:00:00Z"), purpose: "After", event: null },
    ]);
    await expect(assertRoomAvailable(prisma as never, ROOM, ranges)).resolves.toBeUndefined();
  });

  it("throws a 409 listing each clash", async () => {
    const prisma = createPrismaMock();
    prisma.roomBooking.findMany.mockResolvedValue([
      {
        id: "b1",
        startsAt: at("2026-12-13T09:30:00Z"),
        endsAt: at("2026-12-13T11:00:00Z"),
        purpose: "Choir",
        event: { id: "e1", title: "Choir Practice" },
      },
    ]);
    const error = await assertRoomAvailable(prisma as never, ROOM, ranges).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    const body = (error as ConflictException).getResponse() as { conflicts: unknown[]; message: string };
    expect(body.message).toMatch(/already booked/i);
    expect(body.conflicts).toEqual([
      {
        requestedStartsAt: "2026-12-13T09:00:00.000Z",
        requestedEndsAt: "2026-12-13T10:00:00.000Z",
        bookingId: "b1",
        startsAt: "2026-12-13T09:30:00.000Z",
        endsAt: "2026-12-13T11:00:00.000Z",
        purpose: "Choir",
        eventTitle: "Choir Practice",
      },
    ]);
  });

  it("does nothing for an empty range list", async () => {
    const prisma = createPrismaMock();
    await assertRoomAvailable(prisma as never, ROOM, []);
    expect(prisma.roomBooking.findMany).not.toHaveBeenCalled();
  });
});

describe("isOverlapViolation", () => {
  it("recognizes the exclusion constraint error", () => {
    expect(isOverlapViolation(new Error('violates exclusion constraint "RoomBooking_no_overlap"'))).toBe(true);
    expect(isOverlapViolation({ code: "P2004", meta: { message: "RoomBooking_no_overlap" } })).toBe(true);
    expect(isOverlapViolation(new Error("something else"))).toBe(false);
  });
});
