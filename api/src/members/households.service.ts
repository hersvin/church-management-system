import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { HouseholdCreateInput, HouseholdListQuery, HouseholdUpdateInput } from "@cms/shared";
import { AuditService } from "../audit/audit.service";
import type { SessionUser } from "../auth/session-user";
import { assertBranchAccess, branchFilter } from "../common/branch-scope";
import type { Prisma } from "@cms/database";
import { PrismaService } from "../prisma/prisma.service";

const ROLE_ORDER = { HEAD: 0, SPOUSE: 1, CHILD: 2, OTHER: 3 } as const;

@Injectable()
export class HouseholdsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: SessionUser, { page, pageSize, search, branchId }: HouseholdListQuery) {
    const where: Prisma.HouseholdWhereInput = {
      deletedAt: null,
      ...branchFilter(actor, branchId),
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.household.findMany({
        where,
        include: {
          branch: { select: { id: true, name: true, code: true } },
          _count: { select: { members: { where: { deletedAt: null } } } },
        },
        orderBy: { name: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.household.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async get(actor: SessionUser, id: string) {
    const household = await this.prisma.household.findFirst({
      where: { id, deletedAt: null, ...branchFilter(actor) },
      include: {
        branch: { select: { id: true, name: true, code: true } },
        members: { where: { deletedAt: null }, orderBy: [{ birthDate: "asc" }] },
      },
    });
    if (!household) throw new NotFoundException("Household not found");
    household.members.sort(
      (a, b) => ROLE_ORDER[a.householdRole ?? "OTHER"] - ROLE_ORDER[b.householdRole ?? "OTHER"],
    );
    return household;
  }

  async create(actor: SessionUser, input: HouseholdCreateInput) {
    assertBranchAccess(actor, input.branchId);
    const household = await this.prisma.household.create({ data: input });
    await this.audit.record({
      actorId: actor.id,
      action: "households.create",
      entity: "Household",
      entityId: household.id,
      branchId: input.branchId,
      changes: input,
    });
    return household;
  }

  async update(actor: SessionUser, id: string, input: HouseholdUpdateInput) {
    const existing = await this.findInScope(actor, id);
    if (input.branchId && input.branchId !== existing.branchId) {
      assertBranchAccess(actor, input.branchId);
      if ((await this.activeMemberCount(id)) > 0) {
        throw new BadRequestException("Move this household's members before changing its branch");
      }
    }
    const household = await this.prisma.household.update({ where: { id }, data: input });
    await this.audit.record({
      actorId: actor.id,
      action: "households.update",
      entity: "Household",
      entityId: id,
      branchId: household.branchId,
      changes: input,
    });
    return household;
  }

  async archive(actor: SessionUser, id: string): Promise<void> {
    const existing = await this.findInScope(actor, id);
    if ((await this.activeMemberCount(id)) > 0) {
      throw new BadRequestException("Remove all members from this household before archiving it");
    }
    await this.prisma.household.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.record({
      actorId: actor.id,
      action: "households.archive",
      entity: "Household",
      entityId: id,
      branchId: existing.branchId,
    });
  }

  private activeMemberCount(householdId: string) {
    return this.prisma.member.count({ where: { householdId, deletedAt: null } });
  }

  private async findInScope(actor: SessionUser, id: string) {
    const household = await this.prisma.household.findFirst({
      where: { id, deletedAt: null, ...branchFilter(actor) },
    });
    if (!household) throw new NotFoundException("Household not found");
    return household;
  }
}
