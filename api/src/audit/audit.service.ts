import { Injectable } from "@nestjs/common";
import type { PaginationInput } from "@cms/shared";
import type { Prisma } from "@cms/database";
import { PrismaService } from "../prisma/prisma.service";

const SENSITIVE_KEY = /password|token|secret|hash|pickup/i;

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [
        key,
        SENSITIVE_KEY.test(key) ? "[REDACTED]" : redact(inner),
      ]),
    );
  }
  return value;
}

export interface AuditEntry {
  actorId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  branchId?: string | null;
  changes?: unknown;
  ipAddress?: string | null;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        branchId: entry.branchId ?? null,
        changes:
          entry.changes === undefined ? undefined : (redact(entry.changes) as Prisma.InputJsonValue),
        ipAddress: entry.ipAddress ?? null,
      },
    });
  }

  async list({ page, pageSize }: PaginationInput) {
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count(),
    ]);
    return { items, total, page, pageSize };
  }
}
