import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  expandOccurrences,
  type EventCancelInput,
  type EventCreateInput,
  type EventListQuery,
  type EventUpdateInput,
  type RegistrationCreateInput,
} from "@cms/shared";
import { AuditService } from "../audit/audit.service";
import type { SessionUser } from "../auth/session-user";
import { assertBranchAccess, branchFilter } from "../common/branch-scope";
import type { Prisma } from "@cms/database";
import { PrismaService } from "../prisma/prisma.service";
import { assertRoomAvailable, isOverlapViolation, overlapConflict } from "../rooms/availability";
import { canManageRooms } from "../rooms/bookings.service";

const LIST_INCLUDE = {
  room: { select: { id: true, name: true } },
  ministry: { select: { id: true, name: true, category: true } },
  branch: { select: { id: true, name: true, code: true } },
  booking: { select: { id: true, status: true } },
  _count: { select: { registrations: { where: { cancelledAt: null } } } },
} as const;

const MAX_LIST = 500;

/** Attaching a room books it, so it needs the booking permission on top of events.manage. */
function assertCanBook(actor: SessionUser) {
  if (!actor.permissions.includes("rooms.book")) {
    throw new ForbiddenException("You need permission to book rooms to attach a room to an event");
  }
}

const isUniqueViolation = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === "P2002";

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(actor: SessionUser, q: EventListQuery) {
    const where: Prisma.EventWhereInput = {
      ...branchFilter(actor, q.branchId),
      startsAt: { lt: q.to },
      endsAt: { gt: q.from },
      ...(q.includeCancelled ? {} : { status: "SCHEDULED" }),
      ...(q.category ? { category: q.category } : {}),
      ...(q.ministryId ? { ministryId: q.ministryId } : {}),
      ...(q.roomId ? { roomId: q.roomId } : {}),
      ...(q.search ? { title: { contains: q.search, mode: "insensitive" } } : {}),
    };
    return this.prisma.event.findMany({ where, include: LIST_INCLUDE, orderBy: { startsAt: "asc" }, take: MAX_LIST });
  }

  upcoming(actor: SessionUser, limit: number, branchId?: string) {
    return this.prisma.event.findMany({
      where: { ...branchFilter(actor, branchId), status: "SCHEDULED", endsAt: { gt: new Date() } },
      include: LIST_INCLUDE,
      orderBy: { startsAt: "asc" },
      take: limit,
    });
  }

  async get(actor: SessionUser, id: string) {
    const event = await this.prisma.event.findFirst({
      where: { id, ...branchFilter(actor) },
      include: {
        ...LIST_INCLUDE,
        booking: { select: { id: true, status: true, decisionNote: true } },
      },
    });
    if (!event) throw new NotFoundException("Event not found");
    const series = event.seriesId
      ? await this.prisma.event.findMany({
          where: { seriesId: event.seriesId, status: "SCHEDULED" },
          select: { id: true, startsAt: true },
          orderBy: { startsAt: "asc" },
        })
      : [];
    return { ...event, series };
  }

  async create(actor: SessionUser, input: EventCreateInput) {
    if (input.roomId) assertCanBook(actor);
    assertBranchAccess(actor, input.branchId);
    if (input.ministryId) await this.assertMinistry(input.ministryId, input.branchId);
    if (input.roomId) await this.assertRoom(input.roomId, input.branchId);

    const occurrences = expandOccurrences(input.startsAt, input.endsAt, input.repeat);
    if (input.roomId) await assertRoomAvailable(this.prisma, input.roomId, occurrences);

    const { repeat: _repeat, ...fields } = input;
    const seriesId = occurrences.length > 1 ? randomUUID() : undefined;
    const approve = canManageRooms(actor);
    const now = new Date();

    try {
      const events = await this.prisma.$transaction(async (tx) => {
        const rows = [];
        for (const occurrence of occurrences) {
          rows.push(
            await tx.event.create({
              data: {
                ...fields,
                ...occurrence,
                seriesId,
                createdById: actor.id,
                ...(input.roomId
                  ? {
                      booking: {
                        create: {
                          roomId: input.roomId,
                          ...occurrence,
                          purpose: input.title,
                          requestedById: actor.id,
                          status: approve ? "APPROVED" : "PENDING",
                          ...(approve ? { decidedById: actor.id, decidedAt: now } : {}),
                        },
                      },
                    }
                  : {}),
              },
            }),
          );
        }
        return rows;
      });
      await this.record(actor, "events.create", events[0].id, input.branchId, {
        title: input.title,
        occurrences: events.length,
        seriesId,
        roomId: input.roomId,
      });
      return { count: events.length, seriesId: seriesId ?? null, items: events };
    } catch (error) {
      if (isOverlapViolation(error)) throw overlapConflict();
      throw error;
    }
  }

  async update(actor: SessionUser, id: string, input: EventUpdateInput) {
    if (input.roomId) assertCanBook(actor);
    const existing = await this.prisma.event.findFirst({
      where: { id, ...branchFilter(actor) },
      include: { booking: { select: { id: true, roomId: true, status: true } } },
    });
    if (!existing) throw new NotFoundException("Event not found");
    if (existing.status !== "SCHEDULED") throw new BadRequestException("Cancelled events cannot be edited");

    const startsAt = input.startsAt ?? existing.startsAt;
    const endsAt = input.endsAt ?? existing.endsAt;
    if (endsAt <= startsAt) throw new BadRequestException("End must be after start");

    if (input.ministryId) await this.assertMinistry(input.ministryId, existing.branchId);
    if (input.capacity) {
      const registered = await this.prisma.eventRegistration.count({ where: { eventId: id, cancelledAt: null } });
      if (registered > input.capacity) {
        throw new BadRequestException(`${registered} people are already registered; capacity cannot be lower`);
      }
    }

    const roomId = input.roomId === undefined ? existing.roomId : input.roomId;
    if (input.roomId) await this.assertRoom(input.roomId, existing.branchId);
    const scheduleChanged =
      input.startsAt !== undefined || input.endsAt !== undefined || (input.roomId !== undefined && input.roomId !== existing.roomId);
    const booking = existing.booking;
    const bookingActive = booking && (booking.status === "APPROVED" || booking.status === "PENDING");

    if (roomId && (scheduleChanged || !bookingActive)) {
      await assertRoomAvailable(this.prisma, roomId, [{ startsAt, endsAt }], booking ? [booking.id] : []);
    }

    const approve = canManageRooms(actor);
    const decision = approve ? { status: "APPROVED" as const, decidedById: actor.id, decidedAt: new Date() } : { status: "PENDING" as const };

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const event = await tx.event.update({ where: { id }, data: input, include: LIST_INCLUDE });
        if (!roomId) {
          if (bookingActive) await tx.roomBooking.update({ where: { id: booking!.id }, data: { status: "CANCELLED" } });
        } else if (booking) {
          if (scheduleChanged || !bookingActive) {
            await tx.roomBooking.update({
              where: { id: booking.id },
              data: { roomId, startsAt, endsAt, purpose: event.title, ...decision },
            });
          } else if (input.title) {
            await tx.roomBooking.update({ where: { id: booking.id }, data: { purpose: input.title } });
          }
        } else {
          await tx.roomBooking.create({
            data: { roomId, startsAt, endsAt, purpose: event.title, eventId: id, requestedById: actor.id, ...decision },
          });
        }
        return event;
      });
      await this.record(actor, "events.update", id, existing.branchId, input);
      return updated;
    } catch (error) {
      if (isOverlapViolation(error)) throw overlapConflict();
      throw error;
    }
  }

  async cancel(actor: SessionUser, id: string, input: EventCancelInput) {
    const existing = await this.prisma.event.findFirst({ where: { id, ...branchFilter(actor) } });
    if (!existing) throw new NotFoundException("Event not found");
    if (existing.status !== "SCHEDULED") throw new BadRequestException("This event is already cancelled");

    const ids =
      input.scope === "FOLLOWING" && existing.seriesId
        ? (
            await this.prisma.event.findMany({
              where: { seriesId: existing.seriesId, startsAt: { gte: existing.startsAt }, status: "SCHEDULED" },
              select: { id: true },
            })
          ).map((e) => e.id)
        : [id];

    await this.prisma.$transaction(async (tx) => {
      await tx.event.updateMany({ where: { id: { in: ids } }, data: { status: "CANCELLED", cancelReason: input.reason } });
      await tx.roomBooking.updateMany({
        where: { eventId: { in: ids }, status: { in: ["PENDING", "APPROVED"] } },
        data: { status: "CANCELLED" },
      });
    });
    await this.record(actor, "events.cancel", id, existing.branchId, { scope: input.scope, reason: input.reason, cancelled: ids.length });
    return { cancelled: ids.length };
  }

  async registrations(actor: SessionUser, id: string) {
    await this.findInScope(actor, id);
    return this.prisma.eventRegistration.findMany({
      where: { eventId: id, cancelledAt: null },
      include: { member: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  async register(actor: SessionUser, id: string, input: RegistrationCreateInput) {
    const event = await this.findInScope(actor, id);
    if (event.status !== "SCHEDULED" || event.endsAt < new Date()) {
      throw new BadRequestException("Registration is closed for this event");
    }
    if (!event.registrationRequired) throw new BadRequestException("Registration is not enabled for this event");

    if (event.capacity) {
      const registered = await this.prisma.eventRegistration.count({ where: { eventId: id, cancelledAt: null } });
      if (registered >= event.capacity) throw new ConflictException("This event is full");
    }
    if (input.memberId) {
      const member = await this.prisma.member.findFirst({ where: { id: input.memberId, deletedAt: null } });
      if (!member || member.branchId !== event.branchId) {
        throw new BadRequestException("Member not found in this event's branch");
      }
      const duplicate = await this.prisma.eventRegistration.findFirst({
        where: { eventId: id, memberId: input.memberId, cancelledAt: null },
      });
      if (duplicate) throw new ConflictException("This person is already registered");
    }

    try {
      const registration = await this.prisma.eventRegistration.create({
        data: { eventId: id, ...input },
        include: { member: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } },
      });
      await this.record(actor, "events.register", id, event.branchId, {
        memberId: input.memberId,
        guestName: input.guestName,
      });
      return registration;
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException("This person is already registered");
      throw error;
    }
  }

  async cancelRegistration(actor: SessionUser, id: string, registrationId: string): Promise<void> {
    const event = await this.findInScope(actor, id);
    const registration = await this.prisma.eventRegistration.findFirst({
      where: { id: registrationId, eventId: id, cancelledAt: null },
    });
    if (!registration) throw new NotFoundException("Registration not found");
    await this.prisma.eventRegistration.update({ where: { id: registrationId }, data: { cancelledAt: new Date() } });
    await this.record(actor, "events.cancel_registration", id, event.branchId, { registrationId });
  }

  private async findInScope(actor: SessionUser, id: string) {
    const event = await this.prisma.event.findFirst({ where: { id, ...branchFilter(actor) } });
    if (!event) throw new NotFoundException("Event not found");
    return event;
  }

  private async assertRoom(roomId: string, branchId: string) {
    const room = await this.prisma.room.findFirst({ where: { id: roomId, deletedAt: null } });
    if (!room || room.branchId !== branchId) throw new BadRequestException("Room not found in this branch");
    if (!room.isActive) throw new BadRequestException("This room is not available for booking");
  }

  private async assertMinistry(ministryId: string, branchId: string) {
    const ministry = await this.prisma.ministry.findFirst({ where: { id: ministryId, deletedAt: null } });
    if (!ministry || ministry.branchId !== branchId) throw new BadRequestException("Ministry not found in this branch");
  }

  private record(actor: SessionUser, action: string, id: string, branchId: string, changes?: unknown) {
    return this.audit.record({ actorId: actor.id, action, entity: "Event", entityId: id, branchId, changes });
  }
}
