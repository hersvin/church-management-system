import { Injectable } from "@nestjs/common";
import type { SettingUpsertInput } from "@cms/shared";
import { AuditService } from "../audit/audit.service";
import type { Prisma } from "@cms/database";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Global settings, overridden by branch-specific values when a branch is given. */
  async effective(branchId: string | null): Promise<Record<string, unknown>> {
    const rows = await this.prisma.setting.findMany({
      where: branchId ? { OR: [{ branchId: null }, { branchId }] } : { branchId: null },
    });
    const result: Record<string, unknown> = {};
    for (const row of rows.filter((r) => r.branchId === null)) result[row.key] = row.value;
    for (const row of rows.filter((r) => r.branchId !== null)) result[row.key] = row.value;
    return result;
  }

  async upsert(actorId: string, input: SettingUpsertInput) {
    const branchId = input.branchId ?? null;
    const value = input.value as Prisma.InputJsonValue;
    const existing = await this.prisma.setting.findFirst({ where: { key: input.key, branchId } });

    const setting = existing
      ? await this.prisma.setting.update({ where: { id: existing.id }, data: { value } })
      : await this.prisma.setting.create({ data: { key: input.key, value, branchId } });

    await this.audit.record({
      actorId,
      action: "settings.upsert",
      entity: "Setting",
      entityId: setting.id,
      branchId,
      changes: { key: input.key, from: existing?.value ?? null, to: input.value },
    });
    return setting;
  }
}
