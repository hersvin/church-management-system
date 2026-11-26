import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@cms/database";
import {
  attendanceRate,
  dateOnlyToUtc,
  type AttendanceStatus,
  type ClassCreateInput,
  type ClassListQuery,
  type ClassUpdateInput,
  type EnrollmentCreateInput,
  type EnrollmentUpdateInput,
  type TeacherAddInput,
  type TermCreateInput,
  type TermUpdateInput,
} from "@cms/shared";
import { AuditService } from "../audit/audit.service";
import type { SessionUser } from "../auth/session-user";
import { assertBranchAccess, branchFilter } from "../common/branch-scope";
import { PrismaService } from "../prisma/prisma.service";

const isUniqueViolation = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === "P2002";

type StatusCounts = Partial<Record<AttendanceStatus, number>>;

const MEMBER_SELECT = { select: { id: true, firstName: true, lastName: true, status: true, email: true } } as const;

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

@Injectable()
export class SchoolService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---------- Terms ----------

  listTerms(actor: SessionUser, branchId?: string) {
    return this.prisma.schoolTerm.findMany({
      where: { deletedAt: null, ...branchFilter(actor, branchId) },
      include: {
        branch: { select: { id: true, name: true, code: true } },
        _count: { select: { classes: { where: { deletedAt: null } } } },
      },
      orderBy: { startsOn: "desc" },
    });
  }

  async createTerm(actor: SessionUser, input: TermCreateInput) {
    assertBranchAccess(actor, input.branchId);
    const term = await this.prisma.schoolTerm.create({
      data: {
        name: input.name,
        branchId: input.branchId,
        startsOn: dateOnlyToUtc(input.startsOn),
        endsOn: dateOnlyToUtc(input.endsOn),
      },
    });
    await this.record(actor, "school.create_term", "SchoolTerm", term.id, input.branchId, input);
    return term;
  }

  async updateTerm(actor: SessionUser, id: string, input: TermUpdateInput) {
    const term = await this.findTerm(actor, id);
    const startsOn = input.startsOn ? dateOnlyToUtc(input.startsOn) : term.startsOn;
    const endsOn = input.endsOn ? dateOnlyToUtc(input.endsOn) : term.endsOn;
    if (endsOn <= startsOn) throw new BadRequestException("End must be after start");

    const outside = await this.prisma.classSession.count({
      where: { class: { termId: id }, OR: [{ date: { lt: startsOn } }, { date: { gt: endsOn } }] },
    });
    if (outside > 0) {
      throw new BadRequestException(`${outside} recorded session(s) fall outside the new dates`);
    }

    const updated = await this.prisma.schoolTerm.update({
      where: { id },
      data: { ...(input.name ? { name: input.name } : {}), startsOn, endsOn },
    });
    await this.record(actor, "school.update_term", "SchoolTerm", id, term.branchId, input);
    return updated;
  }

  async archiveTerm(actor: SessionUser, id: string): Promise<void> {
    const term = await this.findTerm(actor, id);
    const classes = await this.prisma.schoolClass.count({ where: { termId: id, deletedAt: null } });
    if (classes > 0) throw new BadRequestException("Archive this term's classes first");
    await this.prisma.schoolTerm.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.record(actor, "school.archive_term", "SchoolTerm", id, term.branchId);
  }

  // ---------- Classes ----------

  async listClasses(actor: SessionUser, q: ClassListQuery) {
    const where: Prisma.SchoolClassWhereInput = {
      deletedAt: null,
      term: { deletedAt: null, ...branchFilter(actor, q.branchId) },
      ...(q.termId ? { termId: q.termId } : {}),
      ...(q.audience ? { audience: q.audience } : {}),
      ...(q.search ? { name: { contains: q.search, mode: "insensitive" } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.schoolClass.findMany({
        where,
        include: {
          term: { select: { id: true, name: true, startsOn: true, endsOn: true, branchId: true } },
          room: { select: { id: true, name: true } },
          teachers: { include: { member: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { role: "asc" } },
          _count: { select: { enrollments: { where: { status: "ENROLLED" } } } },
        },
        orderBy: [{ meetingDay: "asc" }, { startTime: "asc" }, { name: "asc" }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.schoolClass.count({ where }),
    ]);
    const rates = await this.classRates(items.map((c) => c.id));
    return {
      items: items.map((c) => ({ ...c, attendanceRate: rates.get(c.id) ?? null })),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  }

  async getClass(actor: SessionUser, id: string) {
    const klass = await this.prisma.schoolClass.findFirst({
      where: { id, deletedAt: null, term: { deletedAt: null, ...branchFilter(actor) } },
      include: {
        term: { select: { id: true, name: true, startsOn: true, endsOn: true, branchId: true } },
        room: { select: { id: true, name: true } },
        teachers: { include: { member: MEMBER_SELECT }, orderBy: { role: "asc" } },
        enrollments: { include: { member: MEMBER_SELECT }, orderBy: [{ status: "asc" }, { enrolledAt: "asc" }] },
      },
    });
    if (!klass) throw new NotFoundException("Class not found");

    const grouped = await this.prisma.sessionAttendance.groupBy({
      by: ["enrollmentId", "status"],
      where: { enrollment: { classId: id } },
      _count: { _all: true },
    });
    const perEnrollment = new Map<string, StatusCounts>();
    for (const g of grouped) {
      const counts = perEnrollment.get(g.enrollmentId) ?? {};
      counts[g.status as AttendanceStatus] = g._count._all;
      perEnrollment.set(g.enrollmentId, counts);
    }
    const rates = await this.classRates([id]);
    return {
      ...klass,
      attendanceRate: rates.get(id) ?? null,
      enrollments: klass.enrollments.map((e) => ({ ...e, attendanceRate: attendanceRate(perEnrollment.get(e.id) ?? {}) })),
    };
  }

  async createClass(actor: SessionUser, input: ClassCreateInput) {
    const term = await this.findTerm(actor, input.termId);
    assertBranchAccess(actor, term.branchId);
    if (input.roomId) await this.assertRoom(input.roomId, term.branchId);
    const klass = await this.prisma.schoolClass.create({ data: input });
    await this.record(actor, "school.create_class", "SchoolClass", klass.id, term.branchId, input);
    return klass;
  }

  async updateClass(actor: SessionUser, id: string, input: ClassUpdateInput) {
    const klass = await this.findClass(actor, id);
    if (input.roomId) await this.assertRoom(input.roomId, klass.term.branchId);
    if (input.capacity) {
      const enrolled = await this.prisma.enrollment.count({ where: { classId: id, status: "ENROLLED" } });
      if (enrolled > input.capacity) {
        throw new BadRequestException(`${enrolled} students are enrolled; capacity cannot be lower`);
      }
    }
    const updated = await this.prisma.schoolClass.update({ where: { id }, data: input });
    await this.record(actor, "school.update_class", "SchoolClass", id, klass.term.branchId, input);
    return updated;
  }

  async archiveClass(actor: SessionUser, id: string): Promise<void> {
    const klass = await this.findClass(actor, id);
    await this.prisma.schoolClass.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.record(actor, "school.archive_class", "SchoolClass", id, klass.term.branchId);
  }

  // ---------- Teachers ----------

  async addTeacher(actor: SessionUser, classId: string, input: TeacherAddInput) {
    const klass = await this.findClass(actor, classId);
    await this.assertMember(input.memberId, klass.term.branchId);
    const enrolled = await this.prisma.enrollment.findFirst({
      where: { classId, memberId: input.memberId, status: "ENROLLED" },
    });
    if (enrolled) throw new BadRequestException("This person is a student in the class");
    try {
      const teacher = await this.prisma.classTeacher.create({
        data: { classId, memberId: input.memberId, role: input.role },
        include: { member: MEMBER_SELECT },
      });
      await this.record(actor, "school.add_teacher", "SchoolClass", classId, klass.term.branchId, input);
      return teacher;
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException("This person already teaches the class");
      throw error;
    }
  }

  async removeTeacher(actor: SessionUser, classId: string, memberId: string): Promise<void> {
    const klass = await this.findClass(actor, classId);
    const teacher = await this.prisma.classTeacher.findFirst({ where: { classId, memberId } });
    if (!teacher) throw new NotFoundException("Teacher not found");
    await this.prisma.classTeacher.delete({ where: { id: teacher.id } });
    await this.record(actor, "school.remove_teacher", "SchoolClass", classId, klass.term.branchId, { memberId });
  }

  // ---------- Enrollment ----------

  async enroll(actor: SessionUser, classId: string, input: EnrollmentCreateInput) {
    const klass = await this.findClass(actor, classId);
    if (klass.term.endsOn < startOfTodayUtc()) throw new BadRequestException("This term has ended");
    await this.assertMember(input.memberId, klass.term.branchId);

    if (await this.prisma.classTeacher.findFirst({ where: { classId, memberId: input.memberId } })) {
      throw new BadRequestException("This person teaches the class");
    }
    if (await this.prisma.enrollment.findFirst({ where: { classId, memberId: input.memberId, status: "ENROLLED" } })) {
      throw new ConflictException("This person is already enrolled");
    }
    if (klass.capacity) {
      const enrolled = await this.prisma.enrollment.count({ where: { classId, status: "ENROLLED" } });
      if (enrolled >= klass.capacity) throw new ConflictException("This class is full");
    }

    try {
      const enrollment = await this.prisma.enrollment.create({ data: { classId, memberId: input.memberId } });
      await this.record(actor, "school.enroll", "SchoolClass", classId, klass.term.branchId, input);
      return enrollment;
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException("This person is already enrolled");
      throw error;
    }
  }

  async updateEnrollment(actor: SessionUser, id: string, input: EnrollmentUpdateInput) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { id, class: { deletedAt: null, term: { deletedAt: null, ...branchFilter(actor) } } },
      include: { class: { include: { term: true } } },
    });
    if (!enrollment) throw new NotFoundException("Enrollment not found");
    if (enrollment.status !== "ENROLLED") throw new BadRequestException("This enrollment is already closed");

    const now = new Date();
    const updated = await this.prisma.enrollment.update({
      where: { id },
      data: {
        status: input.status,
        grade: input.grade,
        note: input.note,
        ...(input.status === "COMPLETED" ? { completedAt: now } : { droppedAt: now }),
      },
    });
    await this.record(actor, "school.update_enrollment", "SchoolClass", enrollment.classId, enrollment.class.term.branchId, {
      enrollmentId: id,
      ...input,
    });
    return updated;
  }

  // ---------- Reporting ----------

  async forMember(actor: SessionUser, memberId: string) {
    const member = await this.prisma.member.findFirst({ where: { id: memberId, deletedAt: null, ...branchFilter(actor) } });
    if (!member) throw new NotFoundException("Member not found");

    const [enrollments, teaching, grouped] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { memberId, class: { deletedAt: null } },
        include: { class: { select: { id: true, name: true, audience: true, term: { select: { name: true, startsOn: true, endsOn: true } } } } },
        orderBy: { enrolledAt: "desc" },
      }),
      this.prisma.classTeacher.findMany({
        where: { memberId, class: { deletedAt: null } },
        include: { class: { select: { id: true, name: true, audience: true, term: { select: { name: true, startsOn: true, endsOn: true } } } } },
      }),
      this.prisma.sessionAttendance.groupBy({
        by: ["enrollmentId", "status"],
        where: { enrollment: { memberId } },
        _count: { _all: true },
      }),
    ]);
    const counts = new Map<string, StatusCounts>();
    for (const g of grouped) {
      const c = counts.get(g.enrollmentId) ?? {};
      c[g.status as AttendanceStatus] = g._count._all;
      counts.set(g.enrollmentId, c);
    }
    return {
      enrollments: enrollments.map((e) => ({ ...e, attendanceRate: attendanceRate(counts.get(e.id) ?? {}) })),
      teaching,
    };
  }

  async stats(actor: SessionUser, branchId?: string) {
    const today = startOfTodayUtc();
    const scope = branchFilter(actor, branchId);
    const currentTerm = { deletedAt: null, startsOn: { lte: today }, endsOn: { gte: today }, ...scope };
    const since = new Date(today.getTime() - 30 * 86400000);

    const [activeClasses, students, grouped] = await Promise.all([
      this.prisma.schoolClass.count({ where: { deletedAt: null, term: currentTerm } }),
      this.prisma.member.count({
        where: { deletedAt: null, enrollments: { some: { status: "ENROLLED", class: { deletedAt: null, term: currentTerm } } } },
      }),
      this.prisma.sessionAttendance.groupBy({
        by: ["status"],
        where: { session: { date: { gte: since }, class: { deletedAt: null, term: { deletedAt: null, ...scope } } } },
        _count: { _all: true },
      }),
    ]);
    const counts: StatusCounts = {};
    for (const g of grouped) counts[g.status as AttendanceStatus] = g._count._all;
    return { activeClasses, students, attendanceRate: attendanceRate(counts) };
  }

  // ---------- Helpers ----------

  private async classRates(classIds: string[]): Promise<Map<string, number | null>> {
    if (classIds.length === 0) return new Map();
    const sessions = await this.prisma.classSession.findMany({
      where: { classId: { in: classIds } },
      select: { id: true, classId: true },
    });
    const classOf = new Map(sessions.map((s) => [s.id, s.classId]));
    const grouped = await this.prisma.sessionAttendance.groupBy({
      by: ["sessionId", "status"],
      where: { sessionId: { in: sessions.map((s) => s.id) } },
      _count: { _all: true },
    });
    const counts = new Map<string, StatusCounts>();
    for (const g of grouped) {
      const classId = classOf.get(g.sessionId);
      if (!classId) continue;
      const c = counts.get(classId) ?? {};
      c[g.status as AttendanceStatus] = (c[g.status as AttendanceStatus] ?? 0) + g._count._all;
      counts.set(classId, c);
    }
    return new Map(classIds.map((id) => [id, attendanceRate(counts.get(id) ?? {})]));
  }

  private async findTerm(actor: SessionUser, id: string) {
    const term = await this.prisma.schoolTerm.findFirst({ where: { id, deletedAt: null, ...branchFilter(actor) } });
    if (!term) throw new NotFoundException("Term not found");
    return term;
  }

  private async findClass(actor: SessionUser, id: string) {
    const klass = await this.prisma.schoolClass.findFirst({
      where: { id, deletedAt: null, term: { deletedAt: null, ...branchFilter(actor) } },
      include: { term: true },
    });
    if (!klass) throw new NotFoundException("Class not found");
    return klass;
  }

  private async assertMember(memberId: string, branchId: string) {
    const member = await this.prisma.member.findFirst({ where: { id: memberId, deletedAt: null } });
    if (!member || member.branchId !== branchId) throw new BadRequestException("Member not found in this branch");
  }

  private async assertRoom(roomId: string, branchId: string) {
    const room = await this.prisma.room.findFirst({ where: { id: roomId, deletedAt: null } });
    if (!room || room.branchId !== branchId) throw new BadRequestException("Room not found in this branch");
    if (!room.isActive) throw new BadRequestException("This room is inactive");
  }

  private record(actor: SessionUser, action: string, entity: string, id: string, branchId: string, changes?: unknown) {
    return this.audit.record({ actorId: actor.id, action, entity, entityId: id, branchId, changes });
  }
}
