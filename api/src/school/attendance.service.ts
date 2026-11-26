import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  attendanceRate,
  dateOnlyToUtc,
  type AttendanceSaveInput,
  type AttendanceStatus,
  type SessionCreateInput,
} from "@cms/shared";
import { AuditService } from "../audit/audit.service";
import type { SessionUser } from "../auth/session-user";
import { branchFilter } from "../common/branch-scope";
import { PrismaService } from "../prisma/prisma.service";

const isUniqueViolation = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === "P2002";

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listSessions(actor: SessionUser, classId: string) {
    await this.findClass(actor, classId);
    const sessions = await this.prisma.classSession.findMany({ where: { classId }, orderBy: { date: "desc" } });
    const grouped = await this.prisma.sessionAttendance.groupBy({
      by: ["sessionId", "status"],
      where: { session: { classId } },
      _count: { _all: true },
    });
    const counts = new Map<string, Partial<Record<AttendanceStatus, number>>>();
    for (const g of grouped) {
      const c = counts.get(g.sessionId) ?? {};
      c[g.status as AttendanceStatus] = g._count._all;
      counts.set(g.sessionId, c);
    }
    return sessions.map((s) => {
      const c = counts.get(s.id) ?? {};
      return { ...s, counts: c, recorded: Object.values(c).reduce((a, b) => a + (b ?? 0), 0), attendanceRate: attendanceRate(c) };
    });
  }

  async createSession(actor: SessionUser, classId: string, input: SessionCreateInput) {
    const klass = await this.findClass(actor, classId);
    const date = dateOnlyToUtc(input.date);
    if (date < klass.term.startsOn || date > klass.term.endsOn) {
      throw new BadRequestException("The session date must fall within the term");
    }
    try {
      const session = await this.prisma.classSession.create({
        data: { classId, date, topic: input.topic, notes: input.notes },
      });
      await this.audit.record({
        actorId: actor.id,
        action: "school.create_session",
        entity: "SchoolClass",
        entityId: classId,
        branchId: klass.term.branchId,
        changes: input,
      });
      return session;
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException("This class already has a session on that date");
      throw error;
    }
  }

  /** The session plus its register: every student not dropped before the session date. */
  async getSession(actor: SessionUser, sessionId: string) {
    const session = await this.findSession(actor, sessionId);
    const [enrollments, records] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { classId: session.classId, ...this.eligibleAt(session.date) },
        include: { member: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: [{ member: { lastName: "asc" } }, { member: { firstName: "asc" } }],
      }),
      this.prisma.sessionAttendance.findMany({ where: { sessionId } }),
    ]);
    const byEnrollment = new Map(records.map((r) => [r.enrollmentId, r]));
    return {
      session,
      register: enrollments.map((e) => ({
        enrollmentId: e.id,
        member: e.member,
        status: (byEnrollment.get(e.id)?.status ?? null) as AttendanceStatus | null,
        note: byEnrollment.get(e.id)?.note ?? null,
      })),
    };
  }

  async saveAttendance(actor: SessionUser, sessionId: string, input: AttendanceSaveInput) {
    const session = await this.findSession(actor, sessionId);
    const eligible = await this.prisma.enrollment.findMany({
      where: { classId: session.classId, ...this.eligibleAt(session.date) },
      select: { id: true },
    });
    const allowed = new Set(eligible.map((e) => e.id));
    const unknown = input.records.filter((r) => !allowed.has(r.enrollmentId));
    if (unknown.length > 0) {
      throw new BadRequestException(`${unknown.length} student(s) are not on this session's register`);
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      for (const r of input.records) {
        await tx.sessionAttendance.upsert({
          where: { sessionId_enrollmentId: { sessionId, enrollmentId: r.enrollmentId } },
          create: { sessionId, enrollmentId: r.enrollmentId, status: r.status, note: r.note, recordedById: actor.id },
          update: { status: r.status, note: r.note, recordedById: actor.id, recordedAt: now },
        });
      }
    });

    const totals: Partial<Record<AttendanceStatus, number>> = {};
    for (const r of input.records) totals[r.status] = (totals[r.status] ?? 0) + 1;
    await this.audit.record({
      actorId: actor.id,
      action: "school.attendance",
      entity: "ClassSession",
      entityId: sessionId,
      branchId: session.class.term.branchId,
      changes: totals,
    });
    return this.getSession(actor, sessionId);
  }

  /** Students count for a date unless they dropped on or before it. */
  private eligibleAt(date: Date) {
    return { OR: [{ status: { not: "DROPPED" as const } }, { droppedAt: { gt: date } }] };
  }

  private async findClass(actor: SessionUser, classId: string) {
    const klass = await this.prisma.schoolClass.findFirst({
      where: { id: classId, deletedAt: null, term: { deletedAt: null, ...branchFilter(actor) } },
      include: { term: true },
    });
    if (!klass) throw new NotFoundException("Class not found");
    return klass;
  }

  private async findSession(actor: SessionUser, sessionId: string) {
    const session = await this.prisma.classSession.findFirst({
      where: { id: sessionId, class: { deletedAt: null, term: { deletedAt: null, ...branchFilter(actor) } } },
      include: { class: { include: { term: true } } },
    });
    if (!session) throw new NotFoundException("Session not found");
    return session;
  }
}
