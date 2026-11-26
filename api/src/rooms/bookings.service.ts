import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { BookingCreateInput, BookingDecisionInput, BookingListQuery } from "@cms/shared";
import { AuditService } from "../audit/audit.service";
import type { SessionUser } from "../auth/session-user";
import { branchFilter } from "../common/branch-scope";
import type { Prisma } from "@cms/database";
import { PrismaService } from "../prisma/prisma.service";
import { assertRoomAvailable, isOverlapViolation, overlapConflict } from "./availability";

/** Small grace period so a booking made "now" from a slow form is not rejected. */
const PAST_GRACE_MS = 5 * 60 * 1000;

const BOOKING_INCLUDE = {
  room: { select: { id: true, name: true, branchId: true } },
  event: { select: { id: true, title: true } },
} as const;

export const canManageRooms = (actor: SessionUser) => actor.permissions.includes("rooms.manage");

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(actor: SessionUser, { from, to, roomId, status, branchId }: BookingListQuery) {
    const where: Prisma.RoomBookingWhereInput = {
      startsAt: { lt: to },
      endsAt: { gt: from },
      room: { deletedAt: null, ...branchFilter(actor, branchId) },
      status: status ?? { in: ["PENDING", "APPROVED"] },
      ...(roomId ? { roomId } : {}),
    };
    return this.prisma.roomBooking.findMany({ where, include: BOOKING_INCLUDE, orderBy: { startsAt: "asc" } });
  }

  pending(actor: SessionUser, branchId?: string) {
    return this.prisma.roomBooking.findMany({
      where: {
        status: "PENDING",
        endsAt: { gt: new Date() },
        room: { deletedAt: null, ...branchFilter(actor, branchId) },
      },
      include: BOOKING_INCLUDE,
      orderBy: { startsAt: "asc" },
    });
  }

  async create(actor: SessionUser, input: BookingCreateInput) {
    const room = await this.prisma.room.findFirst({
      where: { id: input.roomId, deletedAt: null, ...branchFilter(actor) },
    });
    if (!room) throw new NotFoundException("Room not found");
    if (!room.isActive) throw new BadRequestException("This room is not available for booking");
    if (input.startsAt.getTime() < Date.now() - PAST_GRACE_MS) {
      throw new BadRequestException("Bookings cannot start in the past");
    }

    await assertRoomAvailable(this.prisma, room.id, [input]);

    const autoApprove = canManageRooms(actor);
    try {
      const booking = await this.prisma.roomBooking.create({
        data: {
          ...input,
          requestedById: actor.id,
          status: autoApprove ? "APPROVED" : "PENDING",
          ...(autoApprove ? { decidedById: actor.id, decidedAt: new Date() } : {}),
        },
        include: BOOKING_INCLUDE,
      });
      await this.record(actor, "bookings.create", booking.id, room.branchId, { ...input, status: booking.status });
      return booking;
    } catch (error) {
      if (isOverlapViolation(error)) throw overlapConflict();
      throw error;
    }
  }

  async approve(actor: SessionUser, id: string, input: BookingDecisionInput) {
    const booking = await this.findPending(actor, id);
    await assertRoomAvailable(this.prisma, booking.roomId, [booking], [booking.id]);
    try {
      const updated = await this.prisma.roomBooking.update({
        where: { id },
        data: { status: "APPROVED", decisionNote: input.note, decidedById: actor.id, decidedAt: new Date() },
        include: BOOKING_INCLUDE,
      });
      await this.record(actor, "bookings.approve", id, booking.room.branchId, input);
      return updated;
    } catch (error) {
      if (isOverlapViolation(error)) throw overlapConflict();
      throw error;
    }
  }

  async reject(actor: SessionUser, id: string, input: BookingDecisionInput) {
    const booking = await this.findPending(actor, id);
    const updated = await this.prisma.roomBooking.update({
      where: { id },
      data: { status: "REJECTED", decisionNote: input.note, decidedById: actor.id, decidedAt: new Date() },
      include: BOOKING_INCLUDE,
    });
    await this.record(actor, "bookings.reject", id, booking.room.branchId, input);
    return updated;
  }

  async cancel(actor: SessionUser, id: string) {
    const booking = await this.findInScope(actor, id);
    if (booking.eventId) {
      throw new BadRequestException("This booking belongs to an event. Change or cancel the event instead.");
    }
    if (booking.requestedById !== actor.id && !canManageRooms(actor)) {
      throw new ForbiddenException("Only the requester or a room manager can cancel this booking");
    }
    if (booking.status !== "PENDING" && booking.status !== "APPROVED") {
      throw new BadRequestException("This booking is no longer active");
    }
    const updated = await this.prisma.roomBooking.update({ where: { id }, data: { status: "CANCELLED" } });
    await this.record(actor, "bookings.cancel", id, booking.room.branchId);
    return updated;
  }

  private async findInScope(actor: SessionUser, id: string) {
    const booking = await this.prisma.roomBooking.findFirst({
      where: { id, room: { deletedAt: null, ...branchFilter(actor) } },
      include: { room: { select: { branchId: true } } },
    });
    if (!booking) throw new NotFoundException("Booking not found");
    return booking;
  }

  private async findPending(actor: SessionUser, id: string) {
    const booking = await this.findInScope(actor, id);
    if (booking.status !== "PENDING") throw new BadRequestException("Only pending requests can be approved or rejected");
    return booking;
  }

  private record(actor: SessionUser, action: string, id: string, branchId: string, changes?: unknown) {
    return this.audit.record({ actorId: actor.id, action, entity: "RoomBooking", entityId: id, branchId, changes });
  }
}
