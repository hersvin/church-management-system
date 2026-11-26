import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { BranchCreateInput, BranchUpdateInput } from "@cms/shared";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.prisma.branch.findMany({ orderBy: { name: "asc" } });
  }

  async create(actorId: string, input: BranchCreateInput) {
    if (await this.prisma.branch.findUnique({ where: { code: input.code } })) {
      throw new ConflictException(`Branch code ${input.code} is already in use`);
    }
    const branch = await this.prisma.branch.create({ data: input });
    await this.audit.record({
      actorId,
      action: "branches.create",
      entity: "Branch",
      entityId: branch.id,
      branchId: branch.id,
      changes: input,
    });
    return branch;
  }

  async update(actorId: string, id: string, input: BranchUpdateInput) {
    if (!(await this.prisma.branch.findUnique({ where: { id } }))) {
      throw new NotFoundException("Branch not found");
    }
    if (input.code) {
      const clash = await this.prisma.branch.findFirst({ where: { code: input.code, NOT: { id } } });
      if (clash) throw new ConflictException(`Branch code ${input.code} is already in use`);
    }
    const branch = await this.prisma.branch.update({ where: { id }, data: input });
    await this.audit.record({
      actorId,
      action: "branches.update",
      entity: "Branch",
      entityId: id,
      branchId: id,
      changes: input,
    });
    return branch;
  }
}
