import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { PaginationInput, UserCreateInput, UserUpdateInput } from "@cms/shared";
import bcrypt from "bcryptjs";
import { AuditService } from "../audit/audit.service";
import { isChurchWide, type SessionUser } from "../auth/session-user";
import { PrismaService } from "../prisma/prisma.service";

const BCRYPT_COST = 12;

const PUBLIC_FIELDS = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  branchId: true,
  memberId: true,
  member: { select: { id: true, firstName: true, lastName: true } },
  role: { select: { key: true, name: true } },
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: SessionUser, { page, pageSize }: PaginationInput) {
    const where = isChurchWide(actor) ? {} : { branchId: actor.branchId };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: PUBLIC_FIELDS,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async create(actor: SessionUser, input: UserCreateInput) {
    this.assertCanAssign(actor, input.roleKey, input.branchId);

    if (await this.prisma.user.findUnique({ where: { email: input.email } })) {
      throw new ConflictException("A user with this email already exists");
    }
    const role = await this.findRole(input.roleKey);

    const { password, roleKey: _roleKey, ...rest } = input;
    const created = await this.prisma.user.create({
      data: { ...rest, roleId: role.id, passwordHash: await bcrypt.hash(password, BCRYPT_COST) },
    });
    const { passwordHash: _hash, ...user } = created;

    await this.audit.record({
      actorId: actor.id,
      action: "users.create",
      entity: "User",
      entityId: user.id,
      branchId: input.branchId,
      changes: { email: input.email, roleKey: input.roleKey, branchId: input.branchId },
    });
    return user;
  }

  async update(actor: SessionUser, id: string, input: UserUpdateInput) {
    const existing = await this.prisma.user.findUnique({ where: { id }, include: { role: true } });
    if (!existing || (!isChurchWide(actor) && existing.branchId !== actor.branchId)) {
      throw new NotFoundException("User not found");
    }
    if (id === actor.id && (input.isActive === false || input.roleKey !== undefined)) {
      throw new ForbiddenException("You cannot deactivate or change the role of your own account");
    }
    if (input.roleKey !== undefined || input.branchId !== undefined) {
      this.assertCanAssign(actor, input.roleKey ?? existing.role.key, input.branchId ?? existing.branchId);
    }

    if (input.memberId) {
      const member = await this.prisma.member.findFirst({ where: { id: input.memberId, deletedAt: null } });
      if (!member) throw new BadRequestException("Member not found");
    }

    const { roleKey, ...rest } = input;
    const roleId = roleKey ? (await this.findRole(roleKey)).id : undefined;
    // A new member link also revokes sessions, so QR cards issued under the old link stop working.
    const revokeSessions = input.isActive === false || roleKey !== undefined || input.branchId !== undefined || input.memberId !== undefined;

    let updated;
    try {
      updated = await this.prisma.user.update({
        where: { id },
        data: {
          ...rest,
          ...(roleId ? { roleId } : {}),
          ...(revokeSessions ? { tokenVersion: { increment: 1 } } : {}),
        },
        select: PUBLIC_FIELDS,
      });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        throw new ConflictException("This member is already linked to another account");
      }
      throw error;
    }

    await this.audit.record({
      actorId: actor.id,
      action: "users.update",
      entity: "User",
      entityId: id,
      branchId: existing.branchId,
      changes: input,
    });
    return updated;
  }

  private assertCanAssign(actor: SessionUser, roleKey: string, branchId: string | null) {
    if (isChurchWide(actor)) return;
    if (roleKey !== "STAFF" || branchId !== actor.branchId) {
      throw new ForbiddenException("You can only manage staff accounts in your own branch");
    }
  }

  private async findRole(key: string) {
    const role = await this.prisma.role.findUnique({ where: { key } });
    if (!role) throw new NotFoundException(`Role ${key} not found`);
    return role;
  }
}
