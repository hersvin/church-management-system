import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  MEMBER_STATUSES,
  type MemberCreateInput,
  type MemberListQuery,
  type MemberStatus,
  type MemberUpdateInput,
} from "@cms/shared";
import { AuditService } from "../audit/audit.service";
import type { SessionUser } from "../auth/session-user";
import { assertBranchAccess, branchFilter } from "../common/branch-scope";
import type { Prisma } from "@cms/database";
import { PrismaService } from "../prisma/prisma.service";

const LIST_INCLUDE = {
  household: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true, code: true } },
} as const;

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: SessionUser, query: MemberListQuery) {
    const { page, pageSize, search, status, householdId, branchId } = query;
    const where: Prisma.MemberWhereInput = {
      deletedAt: null,
      ...branchFilter(actor, branchId),
      ...(status ? { status } : {}),
      ...(householdId ? { householdId } : {}),
      ...(search
        ? {
            AND: [
              {
                OR: [
                  { firstName: { contains: search, mode: "insensitive" } },
                  { lastName: { contains: search, mode: "insensitive" } },
                  { email: { contains: search, mode: "insensitive" } },
                  { phone: { contains: search } },
                ],
              },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.member.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.member.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async get(actor: SessionUser, id: string) {
    const member = await this.prisma.member.findFirst({
      where: { id, deletedAt: null, ...branchFilter(actor) },
      include: {
        ...LIST_INCLUDE,
        statusHistory: { orderBy: { changedAt: "desc" } },
      },
    });
    if (!member) throw new NotFoundException("Member not found");
    return member;
  }

  async create(actor: SessionUser, input: MemberCreateInput) {
    assertBranchAccess(actor, input.branchId);
    if (input.householdId) await this.assertHousehold(input.householdId, input.branchId);

    const member = await this.prisma.member.create({
      data: {
        ...input,
        statusHistory: {
          create: { fromStatus: null, toStatus: input.status, changedById: actor.id },
        },
      },
      include: LIST_INCLUDE,
    });
    await this.audit.record({
      actorId: actor.id,
      action: "members.create",
      entity: "Member",
      entityId: member.id,
      branchId: input.branchId,
      changes: { firstName: input.firstName, lastName: input.lastName, status: input.status },
    });
    return member;
  }

  async update(actor: SessionUser, id: string, input: MemberUpdateInput) {
    const existing = await this.findInScope(actor, id);
    const { statusNote, ...fields } = input;

    const branchId = fields.branchId ?? existing.branchId;
    if (fields.branchId) assertBranchAccess(actor, fields.branchId);

    const householdId = fields.householdId === undefined ? existing.householdId : fields.householdId;
    if (householdId && (fields.householdId !== undefined || fields.branchId !== undefined)) {
      await this.assertHousehold(householdId, branchId);
    }

    const statusChanged = fields.status !== undefined && fields.status !== existing.status;
    const data: Prisma.MemberUncheckedUpdateInput = {
      ...fields,
      ...(fields.householdId === null ? { householdRole: null } : {}),
      ...(statusChanged
        ? {
            statusHistory: {
              create: {
                fromStatus: existing.status,
                toStatus: fields.status!,
                note: statusNote,
                changedById: actor.id,
              },
            },
          }
        : {}),
    };

    const member = await this.prisma.member.update({ where: { id }, data, include: LIST_INCLUDE });
    await this.audit.record({
      actorId: actor.id,
      action: "members.update",
      entity: "Member",
      entityId: id,
      branchId,
      changes: input,
    });
    return member;
  }

  async archive(actor: SessionUser, id: string): Promise<void> {
    const existing = await this.findInScope(actor, id);
    await this.prisma.member.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.record({
      actorId: actor.id,
      action: "members.archive",
      entity: "Member",
      entityId: id,
      branchId: existing.branchId,
    });
  }

  async stats(actor: SessionUser, branchId?: string) {
    const where: Prisma.MemberWhereInput = { deletedAt: null, ...branchFilter(actor, branchId) };
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [groups, newThisMonth, households] = await Promise.all([
      this.prisma.member.groupBy({ by: ["status"], where, _count: { _all: true } }),
      this.prisma.member.count({ where: { ...where, createdAt: { gte: monthStart } } }),
      this.prisma.household.count({ where: { deletedAt: null, ...branchFilter(actor, branchId) } }),
    ]);

    const byStatus = Object.fromEntries(MEMBER_STATUSES.map((s) => [s, 0])) as Record<MemberStatus, number>;
    for (const group of groups) byStatus[group.status as MemberStatus] = group._count._all;
    const total = Object.values(byStatus).reduce((sum, n) => sum + n, 0);
    return { total, byStatus, newThisMonth, households };
  }

  private async findInScope(actor: SessionUser, id: string) {
    const member = await this.prisma.member.findFirst({
      where: { id, deletedAt: null, ...branchFilter(actor) },
    });
    if (!member) throw new NotFoundException("Member not found");
    return member;
  }

  private async assertHousehold(householdId: string, branchId: string) {
    const household = await this.prisma.household.findFirst({ where: { id: householdId, deletedAt: null } });
    if (!household) throw new BadRequestException("Household not found");
    if (household.branchId !== branchId) {
      throw new BadRequestException("Household belongs to a different branch");
    }
  }
}
