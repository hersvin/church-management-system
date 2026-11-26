import { Injectable, NotFoundException } from "@nestjs/common";
import {
  CHURCH_UTC_OFFSET_MINUTES,
  reportedAttendance,
  weekStartKey,
  type AttendanceStatsQuery,
  type ServiceCreateInput,
  type ServiceListQuery,
  type ServiceUpdateInput,
} from "@cms/shared";
import type { Prisma } from "@cms/database";
import { AuditService } from "../audit/audit.service";
import type { SessionUser } from "../auth/session-user";
import { assertBranchAccess, branchFilter } from "../common/branch-scope";
import { PrismaService } from "../prisma/prisma.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_WEEKS = 8;

/** UTC instant of local midnight on a YYYY-MM-DD church date. */
const localMidnight = (key: string) => new Date(Date.parse(`${key}T00:00:00Z`) - CHURCH_UTC_OFFSET_MINUTES * 60 * 1000);

interface Counts {
  checkIns: number;
  children: number;
}

@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: SessionUser, q: ServiceListQuery) {
    const startsAt: Prisma.DateTimeFilter = {};
    if (q.from) startsAt.gte = q.from;
    if (q.to) startsAt.lt = q.to;
    const where: Prisma.ServiceWhereInput = {
      ...branchFilter(actor, q.branchId),
      deletedAt: null,
      ...(q.from || q.to ? { startsAt } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        include: { branch: { select: { id: true, name: true, code: true } } },
        orderBy: { startsAt: "desc" },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.service.count({ where }),
    ]);
    const counts = await this.countsFor(rows.map((r) => r.id));
    return {
      items: rows.map((r) => this.withCounts(r, counts.get(r.id))),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  }

  async get(actor: SessionUser, id: string) {
    const service = await this.prisma.service.findFirst({
      where: { id, deletedAt: null, ...branchFilter(actor) },
      include: { branch: { select: { id: true, name: true, code: true } } },
    });
    if (!service) throw new NotFoundException("Service not found");
    const counts = await this.countsFor([id]);
    return this.withCounts(service, counts.get(id));
  }

  async create(actor: SessionUser, input: ServiceCreateInput) {
    assertBranchAccess(actor, input.branchId);
    const branch = await this.prisma.branch.findUnique({ where: { id: input.branchId } });
    if (!branch) throw new NotFoundException("Branch not found");
    const service = await this.prisma.service.create({
      data: {
        branchId: input.branchId,
        name: input.name,
        startsAt: input.startsAt,
        headcount: input.headcount,
        notes: input.notes,
        createdById: actor.id,
      },
    });
    await this.record(actor, "attendance.create_service", service.id, input.branchId, input);
    return service;
  }

  async update(actor: SessionUser, id: string, input: ServiceUpdateInput) {
    const existing = await this.findInScope(actor, id);
    const service = await this.prisma.service.update({ where: { id }, data: input });
    await this.record(actor, "attendance.update_service", id, existing.branchId, input);
    return service;
  }

  async archive(actor: SessionUser, id: string): Promise<void> {
    const existing = await this.findInScope(actor, id);
    await this.prisma.service.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.record(actor, "attendance.archive_service", id, existing.branchId);
  }

  /** Weekly attendance for the last `weeks` weeks (ending with this week) and children still in care. */
  async stats(actor: SessionUser, q: { branchId?: string; weeks: AttendanceStatsQuery["weeks"] }) {
    const now = new Date();
    const currentWeek = weekStartKey(now);
    const keys = Array.from({ length: q.weeks }, (_, i) =>
      new Date(Date.parse(`${currentWeek}T00:00:00Z`) - (q.weeks - 1 - i) * 7 * DAY_MS).toISOString().slice(0, 10),
    );
    const scope = branchFilter(actor, q.branchId);

    const services = await this.prisma.service.findMany({
      where: { ...scope, deletedAt: null, startsAt: { gte: localMidnight(keys[0]), lte: now } },
      select: { id: true, headcount: true, startsAt: true },
    });
    const counts = await this.countsFor(services.map((s) => s.id));
    const buckets = new Map(keys.map((weekOf) => [weekOf, { weekOf, attendance: 0, checkIns: 0, children: 0, services: 0 }]));
    for (const s of services) {
      const bucket = buckets.get(weekStartKey(s.startsAt));
      if (!bucket) continue;
      const c = counts.get(s.id) ?? { checkIns: 0, children: 0 };
      bucket.attendance += reportedAttendance(s.headcount, c.checkIns);
      bucket.checkIns += c.checkIns;
      bucket.children += c.children;
      bucket.services += 1;
    }

    const childrenInCare = await this.prisma.checkIn.count({ where: { ...scope, kind: "CHILD", checkedOutAt: null } });
    return { weeks: [...buckets.values()], childrenInCare };
  }

  /** A member's recent check-ins and how many fell in the last eight weeks. */
  async forMember(actor: SessionUser, memberId: string) {
    const member = await this.prisma.member.findFirst({ where: { id: memberId, deletedAt: null, ...branchFilter(actor) } });
    if (!member) throw new NotFoundException("Member not found");
    const since = new Date(Date.now() - RECENT_WEEKS * 7 * DAY_MS);
    const [items, recentCount] = await Promise.all([
      this.prisma.checkIn.findMany({
        where: { memberId },
        select: {
          id: true,
          kind: true,
          checkedInAt: true,
          checkedOutAt: true,
          service: { select: { id: true, name: true, startsAt: true } },
          event: { select: { id: true, title: true, startsAt: true } },
        },
        orderBy: { checkedInAt: "desc" },
        take: 20,
      }),
      this.prisma.checkIn.count({ where: { memberId, checkedInAt: { gte: since } } }),
    ]);
    return { items, recentCount, recentWeeks: RECENT_WEEKS };
  }

  private async countsFor(serviceIds: string[]): Promise<Map<string, Counts>> {
    const map = new Map<string, Counts>();
    if (serviceIds.length === 0) return map;
    const grouped = await this.prisma.checkIn.groupBy({
      by: ["serviceId", "kind"],
      where: { serviceId: { in: serviceIds } },
      _count: { _all: true },
    });
    for (const g of grouped) {
      if (!g.serviceId) continue;
      const c = map.get(g.serviceId) ?? { checkIns: 0, children: 0 };
      c.checkIns += g._count._all;
      if (g.kind === "CHILD") c.children += g._count._all;
      map.set(g.serviceId, c);
    }
    return map;
  }

  private withCounts<T extends { headcount: number | null }>(service: T, counts?: Counts) {
    const c = counts ?? { checkIns: 0, children: 0 };
    return { ...service, ...c, attendance: reportedAttendance(service.headcount, c.checkIns) };
  }

  private async findInScope(actor: SessionUser, id: string) {
    const service = await this.prisma.service.findFirst({ where: { id, deletedAt: null, ...branchFilter(actor) } });
    if (!service) throw new NotFoundException("Service not found");
    return service;
  }

  private record(actor: SessionUser, action: string, id: string, branchId: string, changes?: unknown) {
    return this.audit.record({ actorId: actor.id, action, entity: "Service", entityId: id, branchId, changes });
  }
}
