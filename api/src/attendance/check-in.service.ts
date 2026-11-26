import { randomInt, timingSafeEqual } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  generatePickupCode,
  MAX_PICKUP_ATTEMPTS,
  summarizeCheckIns,
  type CheckInCreateInput,
  type CheckInKind,
  type CheckOutInput,
} from "@cms/shared";
import { AuditService } from "../audit/audit.service";
import type { SessionUser } from "../auth/session-user";
import { branchFilter } from "../common/branch-scope";
import { PrismaService } from "../prisma/prisma.service";

/** A service or an event that people check in to. */
export type CheckInTarget = { type: "service"; id: string } | { type: "event"; id: string };

const PERSON = { select: { id: true, firstName: true, lastName: true } } as const;
/** Created rows carry the name so the station can confirm who was checked in. */
const WITH_MEMBER = { member: PERSON } as const;

/** Everything a list may show. Pickup codes are deliberately left out. */
const LIST_SELECT = {
  id: true,
  kind: true,
  memberId: true,
  guestName: true,
  guestPhone: true,
  guardianName: true,
  guardianPhone: true,
  careNote: true,
  failedPickupAttempts: true,
  checkedInAt: true,
  checkedOutAt: true,
  pickedUpByName: true,
  overrideReason: true,
  member: { select: { id: true, firstName: true, lastName: true, birthDate: true } },
  guardianMember: PERSON,
  pickedUpByMember: PERSON,
} as const;

/** Household members who may collect a child without an override. */
const GUARDIAN_ROLES = ["HEAD", "SPOUSE"] as const;
const CODE_ATTEMPTS = 5;

const isUniqueViolation = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === "P2002";

const sameName = (a: string, b: string) => a.trim().replace(/\s+/g, " ").toLowerCase() === b.trim().replace(/\s+/g, " ").toLowerCase();

function codesMatch(stored: string, given: string): boolean {
  const a = Buffer.from(stored);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

@Injectable()
export class CheckInService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: SessionUser, target: CheckInTarget) {
    const found = await this.resolveTarget(actor, target);
    const items = await this.prisma.checkIn.findMany({
      where: found.where,
      select: LIST_SELECT,
      orderBy: { checkedInAt: "desc" },
    });
    const registeredIds =
      target.type === "event"
        ? new Set(
            (
              await this.prisma.eventRegistration.findMany({
                where: { eventId: target.id, cancelledAt: null, memberId: { not: null } },
                select: { memberId: true },
              })
            ).map((r) => r.memberId),
          )
        : null;
    return {
      summary: summarizeCheckIns(items as { kind: CheckInKind; memberId: string | null; checkedOutAt: Date | null }[]),
      registered: registeredIds ? registeredIds.size : null,
      items: items.map(({ failedPickupAttempts, ...item }) => ({
        ...item,
        locked: failedPickupAttempts >= MAX_PICKUP_ATTEMPTS,
        registered: registeredIds ? Boolean(item.memberId && registeredIds.has(item.memberId)) : null,
      })),
    };
  }

  /** Checks one person in. For a child the response carries the pickup code; it is never shown again. */
  async checkIn(actor: SessionUser, target: CheckInTarget, input: CheckInCreateInput) {
    const found = await this.resolveTarget(actor, target);

    if (input.memberId) {
      await this.assertMember(input.memberId, found.branchId, "The person");
      const existing = await this.prisma.checkIn.findFirst({ where: { ...found.where, memberId: input.memberId }, select: { id: true } });
      if (existing) throw new ConflictException("This person is already checked in");
    }

    const base = {
      kind: input.kind,
      branchId: found.branchId,
      ...found.where,
      memberId: input.memberId,
      checkedInById: actor.id,
    };

    if (input.kind === "ATTENDEE") {
      const created = await this.createOrConflict({ ...base, guestName: input.guestName, guestPhone: input.guestPhone });
      await this.record(actor, "attendance.check_in", created.id, found.branchId, {
        target,
        kind: input.kind,
        memberId: input.memberId,
        guestName: input.guestName,
      });
      return created;
    }

    if (input.guardianMemberId) await this.assertMember(input.guardianMemberId, found.branchId, "The guardian");
    const childData = {
      ...base,
      guardianMemberId: input.guardianMemberId,
      guardianName: input.guardianName,
      guardianPhone: input.guardianPhone,
      careNote: input.careNote,
    };

    // Codes are unique among children still in care; a rare collision just draws another.
    for (let attempt = 1; ; attempt++) {
      const pickupCode = generatePickupCode(randomInt);
      try {
        const created = await this.prisma.checkIn.create({ data: { ...childData, pickupCode }, include: WITH_MEMBER });
        await this.record(actor, "attendance.check_in", created.id, found.branchId, {
          target,
          kind: input.kind,
          memberId: input.memberId,
          guardianMemberId: input.guardianMemberId,
          guardianName: input.guardianName,
        });
        return { ...created, pickupCode };
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        const duplicate = await this.prisma.checkIn.findFirst({ where: { ...found.where, memberId: input.memberId }, select: { id: true } });
        if (duplicate) throw new ConflictException("This child is already checked in");
        if (attempt >= CODE_ATTEMPTS) throw new ConflictException("Could not issue a pickup code; try again");
      }
    }
  }

  /** People who may collect the child: the guardian named at check-in plus household heads and spouses. */
  async guardians(actor: SessionUser, id: string) {
    const checkIn = await this.findChild(actor, id);
    return {
      guardianName: checkIn.guardianName,
      guardianPhone: checkIn.guardianPhone ?? null,
      members: await this.guardianMembers(checkIn),
    };
  }

  async checkOut(actor: SessionUser, id: string, input: CheckOutInput) {
    const checkIn = await this.findChild(actor, id);
    if (checkIn.checkedOutAt) throw new ConflictException("This child has already been collected");

    if (input.method === "OVERRIDE") {
      if (!actor.permissions.includes("attendance.override")) {
        throw new ForbiddenException("Only an admin or pastor can release a child without the pickup code");
      }
    } else {
      if (checkIn.failedPickupAttempts >= MAX_PICKUP_ATTEMPTS) {
        throw new HttpException("Too many wrong pickup codes. An admin or pastor must release this child.", 423);
      }
      if (!codesMatch(checkIn.pickupCode ?? "", input.code)) {
        await this.prisma.checkIn.update({ where: { id }, data: { failedPickupAttempts: { increment: 1 } } });
        await this.record(actor, "attendance.pickup_failed", id, checkIn.branchId);
        const left = MAX_PICKUP_ATTEMPTS - checkIn.failedPickupAttempts - 1;
        throw new ForbiddenException(
          left > 0 ? `The pickup code does not match. ${left} attempt(s) left.` : "The pickup code does not match. This check-in is now locked.",
        );
      }
      await this.assertGuardian(checkIn, input);
    }

    if (input.pickedUpByMemberId && input.method === "OVERRIDE") {
      await this.assertMember(input.pickedUpByMemberId, checkIn.branchId, "The person collecting");
    }

    const now = new Date();
    const { count } = await this.prisma.checkIn.updateMany({
      where: { id, checkedOutAt: null },
      data: {
        checkedOutAt: now,
        checkedOutById: actor.id,
        pickedUpByMemberId: input.pickedUpByMemberId ?? null,
        pickedUpByName: input.pickedUpByName ?? null,
        overrideReason: input.method === "OVERRIDE" ? input.reason : null,
      },
    });
    if (count === 0) throw new ConflictException("This child has already been collected");

    await this.record(actor, input.method === "OVERRIDE" ? "attendance.pickup_override" : "attendance.check_out", id, checkIn.branchId, {
      pickedUpByMemberId: input.pickedUpByMemberId,
      pickedUpByName: input.pickedUpByName,
      ...(input.method === "OVERRIDE" ? { reason: input.reason } : {}),
    });
    return { id, checkedOutAt: now };
  }

  /** Removes a check-in made by mistake. A collected child's record stays for safety history. */
  async undo(actor: SessionUser, id: string): Promise<void> {
    const checkIn = await this.prisma.checkIn.findFirst({ where: { id, ...branchFilter(actor) } });
    if (!checkIn) throw new NotFoundException("Check-in not found");
    if (checkIn.kind === "CHILD" && checkIn.checkedOutAt) {
      throw new ConflictException("A collected child's record is kept and cannot be removed");
    }
    await this.prisma.checkIn.delete({ where: { id } });
    await this.record(actor, "attendance.undo_check_in", id, checkIn.branchId, { kind: checkIn.kind, memberId: checkIn.memberId });
  }

  private async assertGuardian(
    checkIn: { guardianMemberId: string | null; guardianName: string | null; member: { householdId: string | null } | null },
    input: CheckOutInput,
  ) {
    if (input.pickedUpByName) {
      if (checkIn.guardianName && sameName(checkIn.guardianName, input.pickedUpByName)) return;
      throw new ForbiddenException("This person is not the guardian named at check-in. Use an override.");
    }
    const allowed = await this.guardianMembers(checkIn);
    if (!allowed.some((m) => m.id === input.pickedUpByMemberId)) {
      throw new ForbiddenException("This person is not an authorized guardian of the child. Use an override.");
    }
  }

  private guardianMembers(checkIn: { guardianMemberId: string | null; member: { householdId: string | null } | null }) {
    const householdId = checkIn.member?.householdId;
    const or = [
      ...(checkIn.guardianMemberId ? [{ id: { in: [checkIn.guardianMemberId] } }] : []),
      ...(householdId ? [{ householdId, householdRole: { in: [...GUARDIAN_ROLES] } }] : []),
    ];
    if (or.length === 0) return Promise.resolve([]);
    return this.prisma.member.findMany({
      where: { deletedAt: null, OR: or },
      select: { id: true, firstName: true, lastName: true, householdRole: true, phone: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
  }

  private async findChild(actor: SessionUser, id: string) {
    const checkIn = await this.prisma.checkIn.findFirst({
      where: { id, ...branchFilter(actor) },
      include: { member: { select: { id: true, householdId: true } } },
    });
    if (!checkIn) throw new NotFoundException("Check-in not found");
    if (checkIn.kind !== "CHILD") throw new BadRequestException("Only kids check-ins are checked out");
    return checkIn;
  }

  private async resolveTarget(actor: SessionUser, target: CheckInTarget) {
    if (target.type === "service") {
      const service = await this.prisma.service.findFirst({ where: { id: target.id, deletedAt: null, ...branchFilter(actor) } });
      if (!service) throw new NotFoundException("Service not found");
      return { branchId: service.branchId, where: { serviceId: service.id } };
    }
    const event = await this.prisma.event.findFirst({ where: { id: target.id, ...branchFilter(actor) } });
    if (!event) throw new NotFoundException("Event not found");
    if (event.status !== "SCHEDULED") throw new BadRequestException("Cancelled events do not take check-ins");
    return { branchId: event.branchId, where: { eventId: event.id } };
  }

  private async assertMember(memberId: string, branchId: string, label: string) {
    const member = await this.prisma.member.findFirst({ where: { id: memberId, branchId, deletedAt: null }, select: { id: true } });
    if (!member) throw new BadRequestException(`${label} must be a member of this branch`);
  }

  private async createOrConflict(data: Parameters<PrismaService["checkIn"]["create"]>[0]["data"]) {
    try {
      return await this.prisma.checkIn.create({ data, include: WITH_MEMBER });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException("This person is already checked in");
      throw error;
    }
  }

  private record(actor: SessionUser, action: string, id: string, branchId: string, changes?: unknown) {
    return this.audit.record({ actorId: actor.id, action, entity: "CheckIn", entityId: id, branchId, changes });
  }
}
