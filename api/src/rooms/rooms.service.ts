import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { RoomCreateInput, RoomListQuery, RoomUpdateInput } from "@cms/shared";
import { AuditService } from "../audit/audit.service";
import type { SessionUser } from "../auth/session-user";
import { assertBranchAccess, branchFilter } from "../common/branch-scope";
import type { Prisma } from "@cms/database";
import { PrismaService } from "../prisma/prisma.service";

/** Prisma returns money as Decimal; clients get a plain number of pesos, or null when no rate is set. */
export function withRate<T extends { hourlyRate?: Prisma.Decimal | null }>(room: T): Omit<T, "hourlyRate"> & { hourlyRate: number | null } {
  return { ...room, hourlyRate: room.hourlyRate == null ? null : Number(room.hourlyRate) };
}

function todayWindow() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: SessionUser, { page, pageSize, search, branchId }: RoomListQuery) {
    const where: Prisma.RoomWhereInput = {
      deletedAt: null,
      ...branchFilter(actor, branchId),
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    };
    const { start, end } = todayWindow();
    const [items, total] = await Promise.all([
      this.prisma.room.findMany({
        where,
        include: {
          branch: { select: { id: true, name: true, code: true } },
          bookings: {
            where: { status: "APPROVED", startsAt: { lt: end }, endsAt: { gt: start } },
            select: { id: true, startsAt: true, endsAt: true, purpose: true },
            orderBy: { startsAt: "asc" },
          },
        },
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.room.count({ where }),
    ]);
    return { items: items.map(withRate), total, page, pageSize };
  }

  async get(actor: SessionUser, id: string) {
    const room = await this.prisma.room.findFirst({
      where: { id, deletedAt: null, ...branchFilter(actor) },
      include: { branch: { select: { id: true, name: true, code: true } } },
    });
    if (!room) throw new NotFoundException("Room not found");
    return withRate(room);
  }

  async create(actor: SessionUser, input: RoomCreateInput) {
    assertBranchAccess(actor, input.branchId);
    const room = await this.prisma.room.create({ data: input });
    await this.record(actor, "rooms.create", room.id, input.branchId, input);
    return withRate(room);
  }

  async update(actor: SessionUser, id: string, input: RoomUpdateInput) {
    const existing = await this.get(actor, id);
    const room = await this.prisma.room.update({ where: { id }, data: input });
    await this.record(actor, "rooms.update", id, existing.branchId, input);
    return withRate(room);
  }

  async archive(actor: SessionUser, id: string): Promise<void> {
    const existing = await this.get(actor, id);
    const upcoming = await this.prisma.roomBooking.count({
      where: { roomId: id, status: "APPROVED", endsAt: { gt: new Date() } },
    });
    if (upcoming > 0) {
      throw new BadRequestException(`Move or cancel the ${upcoming} upcoming booking(s) before archiving this room`);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.roomBooking.updateMany({ where: { roomId: id, status: "PENDING" }, data: { status: "CANCELLED" } });
      await tx.room.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    });
    await this.record(actor, "rooms.archive", id, existing.branchId);
  }

  private record(actor: SessionUser, action: string, id: string, branchId: string, changes?: unknown) {
    return this.audit.record({ actorId: actor.id, action, entity: "Room", entityId: id, branchId, changes });
  }
}
