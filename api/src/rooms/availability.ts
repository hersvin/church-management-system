import { ConflictException } from "@nestjs/common";
import { findOverlaps, type TimeRange } from "@cms/shared";
import type { Prisma } from "@cms/database";

type BookingClient = { roomBooking: { findMany: (args: Prisma.RoomBookingFindManyArgs) => Promise<unknown> } };

interface ApprovedBooking extends TimeRange {
  id: string;
  purpose: string;
  event: { id: string; title: string } | null;
}

/**
 * Throws a 409 listing every clash between the requested ranges and approved
 * bookings for the room. The database exclusion constraint is the final guard.
 */
export async function assertRoomAvailable(
  client: BookingClient,
  roomId: string,
  ranges: TimeRange[],
  excludeBookingIds: string[] = [],
): Promise<void> {
  if (ranges.length === 0) return;
  const windowStart = new Date(Math.min(...ranges.map((r) => r.startsAt.getTime())));
  const windowEnd = new Date(Math.max(...ranges.map((r) => r.endsAt.getTime())));

  const existing = (await client.roomBooking.findMany({
    where: {
      roomId,
      status: "APPROVED",
      startsAt: { lt: windowEnd },
      endsAt: { gt: windowStart },
      ...(excludeBookingIds.length ? { id: { notIn: excludeBookingIds } } : {}),
    },
    select: { id: true, startsAt: true, endsAt: true, purpose: true, event: { select: { id: true, title: true } } },
  })) as ApprovedBooking[];

  const clashes = findOverlaps(ranges, existing);
  if (clashes.length === 0) return;

  throw new ConflictException({
    message: "The room is already booked at that time",
    conflicts: clashes.flatMap(({ candidate, conflicts }) =>
      conflicts.map((c) => ({
        requestedStartsAt: candidate.startsAt.toISOString(),
        requestedEndsAt: candidate.endsAt.toISOString(),
        bookingId: c.id,
        startsAt: c.startsAt.toISOString(),
        endsAt: c.endsAt.toISOString(),
        purpose: c.purpose,
        eventTitle: c.event?.title ?? null,
      })),
    ),
  });
}

/** True when Postgres rejected a write because of the RoomBooking_no_overlap exclusion constraint. */
export function isOverlapViolation(error: unknown, depth = 0): boolean {
  if (typeof error === "string") return error.includes("RoomBooking_no_overlap");
  if (typeof error !== "object" || error === null || depth > 4) return false;
  // Prisma and driver errors nest the constraint name in different places (message, meta, cause).
  return Object.getOwnPropertyNames(error).some((key) =>
    isOverlapViolation((error as Record<string, unknown>)[key], depth + 1),
  );
}

export const overlapConflict = () =>
  new ConflictException({ message: "The room was just booked by someone else for that time", conflicts: [] });
