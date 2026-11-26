import { BadRequestException, Injectable } from "@nestjs/common";
import {
  MEMBER_STATUSES,
  buildAttendanceReport,
  buildEventReport,
  buildMembershipReport,
  buildMinistryReport,
  buildRoomReport,
  reportRange,
  toCsv,
  type MemberStatus,
  type Report,
  type ReportBody,
  type ReportKind,
  type ReportQuery,
  type ReportRange,
} from "@cms/shared";
import { AuditService } from "../audit/audit.service";
import type { SessionUser } from "../auth/session-user";
import { branchFilter } from "../common/branch-scope";
import { PrismaService } from "../prisma/prisma.service";

type Scope = { branchId?: string };
const BRANCH_NAME = { branch: { select: { name: true } } } as const;
/** Calendar-date columns are stored at UTC midnight. */
const dateColumn = (key: string) => new Date(`${key}T00:00:00Z`);

/** Read-only reports across contexts. Every query is date-filtered and grouped; none runs per row. */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async build(actor: SessionUser, kind: ReportKind, query: ReportQuery, now = new Date()): Promise<Report> {
    let range: ReportRange;
    try {
      range = reportRange(query, now);
    } catch (error) {
      if (error instanceof RangeError) throw new BadRequestException(error.message);
      throw error;
    }
    const scope = branchFilter(actor, query.branchId);
    const body = await this.body(kind, range, scope);
    return { kind, from: range.from, to: range.to, branchId: scope.branchId ?? null, ...body };
  }

  async exportCsv(actor: SessionUser, kind: ReportKind, query: ReportQuery, now = new Date()) {
    const report = await this.build(actor, kind, query, now);
    await this.audit.record({
      actorId: actor.id,
      action: "reports.export",
      entity: "report",
      entityId: kind,
      branchId: report.branchId,
      changes: { from: report.from, to: report.to, rows: report.rows.length },
    });
    return {
      filename: `${kind}-${report.from}-to-${report.to}.csv`,
      // The byte order mark makes spreadsheet apps read the file as UTF-8.
      body: `﻿${toCsv(report.columns, report.rows)}`,
    };
  }

  private body(kind: ReportKind, range: ReportRange, scope: Scope): Promise<ReportBody> {
    switch (kind) {
      case "attendance":
        return this.attendance(range, scope);
      case "membership":
        return this.membership(range, scope);
      case "ministries":
        return this.ministries(range, scope);
      case "events":
        return this.events(range, scope);
      case "rooms":
        return this.rooms(range, scope);
    }
  }

  private async attendance(range: ReportRange, scope: Scope) {
    const services = await this.prisma.service.findMany({
      where: { ...scope, deletedAt: null, startsAt: { gte: range.start, lt: range.end } },
      select: { id: true, name: true, startsAt: true, headcount: true, ...BRANCH_NAME },
    });
    const counts = new Map<string, { checkIns: number; children: number }>();
    if (services.length > 0) {
      const grouped = await this.prisma.checkIn.groupBy({
        by: ["serviceId", "kind"],
        where: { serviceId: { in: services.map((s) => s.id) } },
        _count: { _all: true },
      });
      for (const g of grouped) {
        const c = counts.get(g.serviceId!) ?? { checkIns: 0, children: 0 };
        c.checkIns += g._count._all;
        if (g.kind === "CHILD") c.children += g._count._all;
        counts.set(g.serviceId!, c);
      }
    }
    return buildAttendanceReport(
      services.map((s) => ({
        startsAt: s.startsAt,
        name: s.name,
        branch: s.branch.name,
        headcount: s.headcount,
        ...(counts.get(s.id) ?? { checkIns: 0, children: 0 }),
      })),
    );
  }

  private async membership(range: ReportRange, scope: Scope) {
    const dates = { gte: dateColumn(range.from), lte: dateColumn(range.to) };
    const base = { ...scope, deletedAt: null };
    const [people, grouped] = await Promise.all([
      this.prisma.member.findMany({
        where: {
          ...base,
          OR: [{ createdAt: { gte: range.start, lt: range.end } }, { membershipDate: dates }, { baptismDate: dates }],
        },
        select: { createdAt: true, membershipDate: true, baptismDate: true },
      }),
      this.prisma.member.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
    ]);
    const statusTotals = Object.fromEntries(MEMBER_STATUSES.map((s) => [s, 0])) as Record<MemberStatus, number>;
    for (const g of grouped) statusTotals[g.status as MemberStatus] = g._count._all;
    return buildMembershipReport(range, { people, statusTotals });
  }

  private async ministries(range: ReportRange, scope: Scope) {
    const [ministries, roster, activePeople] = await Promise.all([
      this.prisma.ministry.findMany({
        where: { ...scope, deletedAt: null },
        select: { id: true, name: true, category: true, ...BRANCH_NAME },
      }),
      this.prisma.ministryMember.findMany({
        where: {
          ministry: { ...scope, deletedAt: null },
          joinedAt: { lt: range.end },
          OR: [{ leftAt: null }, { leftAt: { gte: range.start } }],
        },
        select: { ministryId: true, memberId: true, position: true, joinedAt: true, leftAt: true },
      }),
      this.prisma.member.count({ where: { ...scope, deletedAt: null, status: { not: "INACTIVE" } } }),
    ]);
    return buildMinistryReport(range, {
      ministries: ministries.map((m) => ({ id: m.id, name: m.name, category: m.category, branch: m.branch.name })),
      roster,
      activePeople,
    });
  }

  private async events(range: ReportRange, scope: Scope) {
    const events = await this.prisma.event.findMany({
      where: { ...scope, startsAt: { gte: range.start, lt: range.end } },
      select: { id: true, title: true, category: true, status: true, capacity: true, startsAt: true, ...BRANCH_NAME },
    });
    const ids = events.map((e) => e.id);
    const [registrations, checkIns] =
      ids.length === 0
        ? [[], []]
        : await Promise.all([
            this.prisma.eventRegistration.groupBy({
              by: ["eventId"],
              where: { eventId: { in: ids }, cancelledAt: null },
              _count: { _all: true },
            }),
            this.prisma.checkIn.groupBy({ by: ["eventId"], where: { eventId: { in: ids } }, _count: { _all: true } }),
          ]);
    const registered = new Map(registrations.map((g) => [g.eventId, g._count._all]));
    const checkedIn = new Map(checkIns.map((g) => [g.eventId, g._count._all]));
    return buildEventReport(
      events.map((e) => ({
        startsAt: e.startsAt,
        title: e.title,
        category: e.category,
        status: e.status,
        branch: e.branch.name,
        capacity: e.capacity,
        registered: registered.get(e.id) ?? 0,
        checkedIn: checkedIn.get(e.id) ?? 0,
      })),
    );
  }

  private async rooms(range: ReportRange, scope: Scope) {
    const rooms = await this.prisma.room.findMany({
      where: { ...scope, deletedAt: null, isActive: true },
      select: { id: true, name: true, capacity: true, hourlyRate: true, ...BRANCH_NAME },
    });
    const bookings =
      rooms.length === 0
        ? []
        : await this.prisma.roomBooking.findMany({
            where: { status: "APPROVED", roomId: { in: rooms.map((r) => r.id) }, startsAt: { lt: range.end }, endsAt: { gt: range.start } },
            select: { roomId: true, startsAt: true, endsAt: true },
          });
    return buildRoomReport(range, {
      rooms: rooms.map((r) => ({
        id: r.id,
        name: r.name,
        branch: r.branch.name,
        capacity: r.capacity,
        hourlyRate: r.hourlyRate == null ? null : Number(r.hourlyRate.toString()),
      })),
      bookings,
    });
  }
}
