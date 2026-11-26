import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  MinistryCreateInput,
  MinistryListQuery,
  MinistryMemberAddInput,
  MinistryMemberUpdateInput,
  MinistryRoleCreateInput,
  MinistryUpdateInput,
} from "@cms/shared";
import { AuditService } from "../audit/audit.service";
import type { SessionUser } from "../auth/session-user";
import { assertBranchAccess, branchFilter } from "../common/branch-scope";
import type { Prisma } from "@cms/database";
import { PrismaService } from "../prisma/prisma.service";

const BRANCH_SELECT = { select: { id: true, name: true, code: true } } as const;
const MEMBER_SELECT = {
  select: { id: true, firstName: true, lastName: true, status: true, email: true, phone: true },
} as const;

const isUniqueViolation = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === "P2002";

@Injectable()
export class MinistriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: SessionUser, { page, pageSize, search, category, branchId }: MinistryListQuery) {
    const where: Prisma.MinistryWhereInput = {
      deletedAt: null,
      ...branchFilter(actor, branchId),
      ...(category ? { category } : {}),
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.ministry.findMany({
        where,
        include: {
          branch: BRANCH_SELECT,
          _count: { select: { members: { where: { leftAt: null } } } },
          members: {
            where: { leftAt: null, position: { in: ["LEADER", "COLEADER"] } },
            include: { member: { select: { id: true, firstName: true, lastName: true } } },
            orderBy: { position: "asc" },
          },
        },
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.ministry.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async get(actor: SessionUser, id: string) {
    const ministry = await this.prisma.ministry.findFirst({
      where: { id, deletedAt: null, ...branchFilter(actor) },
      include: {
        branch: BRANCH_SELECT,
        roles: { orderBy: { name: "asc" } },
        members: {
          where: { leftAt: null },
          include: { member: MEMBER_SELECT, ministryRole: true },
          orderBy: [{ position: "asc" }, { joinedAt: "asc" }],
        },
      },
    });
    if (!ministry) throw new NotFoundException("Ministry not found");
    return ministry;
  }

  async create(actor: SessionUser, input: MinistryCreateInput) {
    assertBranchAccess(actor, input.branchId);
    const ministry = await this.prisma.ministry.create({ data: input });
    await this.record(actor, "ministries.create", ministry.id, input.branchId, input);
    return ministry;
  }

  async update(actor: SessionUser, id: string, input: MinistryUpdateInput) {
    const existing = await this.findInScope(actor, id);
    if (input.branchId && input.branchId !== existing.branchId) {
      assertBranchAccess(actor, input.branchId);
      const active = await this.prisma.ministryMember.count({ where: { ministryId: id, leftAt: null } });
      if (active > 0) throw new BadRequestException("Remove everyone from the roster before changing the branch");
    }
    const ministry = await this.prisma.ministry.update({ where: { id }, data: input });
    await this.record(actor, "ministries.update", id, ministry.branchId, input);
    return ministry;
  }

  async archive(actor: SessionUser, id: string): Promise<void> {
    const existing = await this.findInScope(actor, id);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.ministryMember.updateMany({ where: { ministryId: id, leftAt: null }, data: { leftAt: now } });
      await tx.ministry.update({ where: { id }, data: { deletedAt: now, isActive: false } });
    });
    await this.record(actor, "ministries.archive", id, existing.branchId);
  }

  async addRole(actor: SessionUser, id: string, input: MinistryRoleCreateInput) {
    const ministry = await this.findInScope(actor, id);
    const duplicate = await this.prisma.ministryRole.findFirst({
      where: { ministryId: id, name: { equals: input.name, mode: "insensitive" } },
    });
    if (duplicate) throw new ConflictException(`This ministry already has a "${input.name}" role`);
    const role = await this.prisma.ministryRole.create({ data: { name: input.name, ministryId: id } });
    await this.record(actor, "ministries.add_role", id, ministry.branchId, input);
    return role;
  }

  async removeRole(actor: SessionUser, id: string, roleId: string): Promise<void> {
    const ministry = await this.findInScope(actor, id);
    const role = await this.prisma.ministryRole.findFirst({ where: { id: roleId, ministryId: id } });
    if (!role) throw new NotFoundException("Role not found");
    await this.prisma.ministryRole.delete({ where: { id: roleId } });
    await this.record(actor, "ministries.remove_role", id, ministry.branchId, { name: role.name });
  }

  async addMember(actor: SessionUser, id: string, input: MinistryMemberAddInput) {
    const ministry = await this.findInScope(actor, id);
    if (!ministry.isActive) throw new BadRequestException("This ministry is inactive");

    const member = await this.prisma.member.findFirst({ where: { id: input.memberId, deletedAt: null } });
    if (!member) throw new BadRequestException("Member not found");
    if (member.branchId !== ministry.branchId) {
      throw new BadRequestException("Member belongs to a different branch");
    }
    if (input.ministryRoleId) await this.assertRole(id, input.ministryRoleId);

    const active = await this.prisma.ministryMember.findFirst({
      where: { ministryId: id, memberId: input.memberId, leftAt: null },
    });
    if (active) throw new ConflictException("This person is already on the roster");

    try {
      const entry = await this.prisma.ministryMember.create({
        data: { ministryId: id, ...input },
        include: { member: MEMBER_SELECT, ministryRole: true },
      });
      await this.record(actor, "ministries.add_member", id, ministry.branchId, input);
      return entry;
    } catch (error) {
      // The partial unique index catches concurrent adds that slip past the check above.
      if (isUniqueViolation(error)) throw new ConflictException("This person is already on the roster");
      throw error;
    }
  }

  async updateMember(actor: SessionUser, id: string, memberId: string, input: MinistryMemberUpdateInput) {
    const ministry = await this.findInScope(actor, id);
    const entry = await this.findActiveEntry(id, memberId);
    if (input.ministryRoleId) await this.assertRole(id, input.ministryRoleId);
    const updated = await this.prisma.ministryMember.update({
      where: { id: entry.id },
      data: input,
      include: { member: MEMBER_SELECT, ministryRole: true },
    });
    await this.record(actor, "ministries.update_member", id, ministry.branchId, { memberId, ...input });
    return updated;
  }

  async removeMember(actor: SessionUser, id: string, memberId: string): Promise<void> {
    const ministry = await this.findInScope(actor, id);
    const entry = await this.findActiveEntry(id, memberId);
    await this.prisma.ministryMember.update({ where: { id: entry.id }, data: { leftAt: new Date() } });
    await this.record(actor, "ministries.remove_member", id, ministry.branchId, { memberId });
  }

  async forMember(actor: SessionUser, memberId: string) {
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, deletedAt: null, ...branchFilter(actor) },
    });
    if (!member) throw new NotFoundException("Member not found");
    return this.prisma.ministryMember.findMany({
      where: { memberId, ministry: { deletedAt: null } },
      include: {
        ministry: { select: { id: true, name: true, category: true, isActive: true } },
        ministryRole: true,
      },
      orderBy: [{ leftAt: { sort: "desc", nulls: "first" } }, { joinedAt: "desc" }],
    });
  }

  async stats(actor: SessionUser, branchId?: string) {
    const scope = branchFilter(actor, branchId);
    const [ministries, participants] = await Promise.all([
      this.prisma.ministry.count({ where: { deletedAt: null, isActive: true, ...scope } }),
      this.prisma.member.count({
        where: {
          deletedAt: null,
          ...scope,
          ministries: { some: { leftAt: null, ministry: { deletedAt: null } } },
        },
      }),
    ]);
    return { ministries, participants };
  }

  private async findInScope(actor: SessionUser, id: string) {
    const ministry = await this.prisma.ministry.findFirst({ where: { id, deletedAt: null, ...branchFilter(actor) } });
    if (!ministry) throw new NotFoundException("Ministry not found");
    return ministry;
  }

  private async findActiveEntry(ministryId: string, memberId: string) {
    const entry = await this.prisma.ministryMember.findFirst({ where: { ministryId, memberId, leftAt: null } });
    if (!entry) throw new NotFoundException("This person is not on the roster");
    return entry;
  }

  private async assertRole(ministryId: string, roleId: string) {
    const role = await this.prisma.ministryRole.findFirst({ where: { id: roleId, ministryId } });
    if (!role) throw new BadRequestException("Role does not belong to this ministry");
  }

  private record(actor: SessionUser, action: string, id: string, branchId: string, changes?: unknown) {
    return this.audit.record({ actorId: actor.id, action, entity: "Ministry", entityId: id, branchId, changes });
  }
}
