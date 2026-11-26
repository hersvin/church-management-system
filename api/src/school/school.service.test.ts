import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BRANCH_A, BRANCH_B, branchStaff, superAdmin } from "../test/actors";
import { createPrismaMock, type PrismaMock } from "../test/prisma-mock";
import { SchoolService } from "./school.service";

const TERM = "22222222-2222-4222-8222-222222222222";
const CLASS = "66666666-6666-4666-8666-666666666666";
const MEMBER = "55555555-5555-4555-8555-555555555555";
const ROOM = "77777777-7777-4777-8777-777777777777";
const ENROLLMENT = "88888888-8888-4888-8888-888888888888";

const futureDate = (days: number) => new Date(Date.now() + days * 86400000);

describe("SchoolService", () => {
  let prisma: PrismaMock;
  let audit: { record: ReturnType<typeof vi.fn> };
  let service: SchoolService;

  const term = (over: Record<string, unknown> = {}) => ({
    id: TERM,
    branchId: BRANCH_A,
    startsOn: futureDate(-30),
    endsOn: futureDate(60),
    deletedAt: null,
    ...over,
  });
  const klass = (over: Record<string, unknown> = {}) => ({
    id: CLASS,
    termId: TERM,
    capacity: null,
    deletedAt: null,
    term: term(),
    ...over,
  });

  beforeEach(() => {
    prisma = createPrismaMock();
    audit = { record: vi.fn() };
    service = new SchoolService(prisma as never, audit as never);
    prisma.sessionAttendance.groupBy.mockResolvedValue([]);
    prisma.classSession.findMany.mockResolvedValue([]);
  });

  describe("terms", () => {
    it("stores calendar dates as UTC midnight and audits", async () => {
      prisma.schoolTerm.create.mockResolvedValue({ id: TERM });
      await service.createTerm(superAdmin, { name: "Term 2", branchId: BRANCH_A, startsOn: "2026-11-01", endsOn: "2027-02-28" });
      expect(prisma.schoolTerm.create.mock.calls[0][0].data).toEqual({
        name: "Term 2",
        branchId: BRANCH_A,
        startsOn: new Date("2026-11-01T00:00:00.000Z"),
        endsOn: new Date("2027-02-28T00:00:00.000Z"),
      });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "school.create_term" }));
    });

    it("forbids creating a term in another branch", async () => {
      await expect(
        service.createTerm(branchStaff, { name: "T", branchId: BRANCH_B, startsOn: "2026-11-01", endsOn: "2027-02-28" }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("refuses to shrink a term past its recorded sessions", async () => {
      prisma.schoolTerm.findFirst.mockResolvedValue(term());
      prisma.classSession.count.mockResolvedValue(2);
      await expect(service.updateTerm(superAdmin, TERM, { endsOn: "2026-11-02" })).rejects.toThrow(BadRequestException);
    });

    it("refuses to archive a term that still has classes", async () => {
      prisma.schoolTerm.findFirst.mockResolvedValue(term());
      prisma.schoolClass.count.mockResolvedValue(3);
      await expect(service.archiveTerm(superAdmin, TERM)).rejects.toThrow(BadRequestException);
    });
  });

  describe("classes", () => {
    it("lists classes in scope with enrolled counts", async () => {
      prisma.schoolClass.findMany.mockResolvedValue([]);
      prisma.schoolClass.count.mockResolvedValue(0);
      await service.listClasses(branchStaff, { page: 1, pageSize: 20, termId: TERM, audience: "YOUTH" });
      const args = prisma.schoolClass.findMany.mock.calls[0][0];
      expect(args.where).toEqual({
        deletedAt: null,
        term: { deletedAt: null, branchId: BRANCH_A },
        termId: TERM,
        audience: "YOUTH",
      });
      expect(args.include._count.select.enrollments).toEqual({ where: { status: "ENROLLED" } });
    });

    it("adds an attendance rate per class", async () => {
      prisma.schoolClass.findMany.mockResolvedValue([{ id: CLASS }]);
      prisma.schoolClass.count.mockResolvedValue(1);
      prisma.classSession.findMany.mockResolvedValue([{ id: "s1", classId: CLASS }]);
      prisma.sessionAttendance.groupBy.mockResolvedValue([
        { sessionId: "s1", status: "PRESENT", _count: { _all: 3 } },
        { sessionId: "s1", status: "ABSENT", _count: { _all: 1 } },
      ]);
      const result = await service.listClasses(superAdmin, { page: 1, pageSize: 20 });
      expect(result.items[0].attendanceRate).toBe(75);
    });

    it("creates a class in the term's branch with a room from that branch", async () => {
      prisma.schoolTerm.findFirst.mockResolvedValue(term());
      prisma.room.findFirst.mockResolvedValue({ id: ROOM, branchId: BRANCH_A, isActive: true });
      prisma.schoolClass.create.mockResolvedValue({ id: CLASS });
      await service.createClass(superAdmin, { termId: TERM, name: "Grade 3", audience: "CHILDREN", roomId: ROOM });
      expect(prisma.schoolClass.create).toHaveBeenCalled();
    });

    it("rejects a room from another branch", async () => {
      prisma.schoolTerm.findFirst.mockResolvedValue(term());
      prisma.room.findFirst.mockResolvedValue({ id: ROOM, branchId: BRANCH_B, isActive: true });
      await expect(
        service.createClass(superAdmin, { termId: TERM, name: "Grade 3", audience: "CHILDREN", roomId: ROOM }),
      ).rejects.toThrow(BadRequestException);
    });

    it("hides terms outside the actor's branch", async () => {
      prisma.schoolTerm.findFirst.mockResolvedValue(null);
      await expect(service.createClass(branchStaff, { termId: TERM, name: "X", audience: "CHILDREN" })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.schoolTerm.findFirst.mock.calls[0][0].where).toMatchObject({ id: TERM, branchId: BRANCH_A });
    });
  });

  describe("teachers", () => {
    beforeEach(() => {
      prisma.schoolClass.findFirst.mockResolvedValue(klass());
      prisma.member.findFirst.mockResolvedValue({ id: MEMBER, branchId: BRANCH_A });
      prisma.enrollment.findFirst.mockResolvedValue(null);
    });

    it("adds a teacher", async () => {
      prisma.classTeacher.create.mockResolvedValue({ id: "t1" });
      await service.addTeacher(superAdmin, CLASS, { memberId: MEMBER, role: "ASSISTANT" });
      expect(prisma.classTeacher.create.mock.calls[0][0].data).toEqual({ classId: CLASS, memberId: MEMBER, role: "ASSISTANT" });
    });

    it("rejects a teacher who is a student in the class", async () => {
      prisma.enrollment.findFirst.mockResolvedValue({ id: ENROLLMENT });
      await expect(service.addTeacher(superAdmin, CLASS, { memberId: MEMBER, role: "LEAD" })).rejects.toThrow(BadRequestException);
    });

    it("turns a duplicate teacher into a conflict", async () => {
      prisma.classTeacher.create.mockRejectedValue({ code: "P2002" });
      await expect(service.addTeacher(superAdmin, CLASS, { memberId: MEMBER, role: "LEAD" })).rejects.toThrow(ConflictException);
    });

    it("rejects a teacher from another branch", async () => {
      prisma.member.findFirst.mockResolvedValue({ id: MEMBER, branchId: BRANCH_B });
      await expect(service.addTeacher(superAdmin, CLASS, { memberId: MEMBER, role: "LEAD" })).rejects.toThrow(BadRequestException);
    });
  });

  describe("enrollment", () => {
    beforeEach(() => {
      prisma.schoolClass.findFirst.mockResolvedValue(klass());
      prisma.member.findFirst.mockResolvedValue({ id: MEMBER, branchId: BRANCH_A });
      prisma.classTeacher.findFirst.mockResolvedValue(null);
      prisma.enrollment.findFirst.mockResolvedValue(null);
      prisma.enrollment.count.mockResolvedValue(0);
      prisma.enrollment.create.mockImplementation(async ({ data }) => ({ id: ENROLLMENT, ...data }));
    });

    it("enrolls a student and audits it", async () => {
      await service.enroll(superAdmin, CLASS, { memberId: MEMBER });
      expect(prisma.enrollment.create.mock.calls[0][0].data).toEqual({ classId: CLASS, memberId: MEMBER });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "school.enroll" }));
    });

    it("refuses when the class is full", async () => {
      prisma.schoolClass.findFirst.mockResolvedValue(klass({ capacity: 10 }));
      prisma.enrollment.count.mockResolvedValue(10);
      await expect(service.enroll(superAdmin, CLASS, { memberId: MEMBER })).rejects.toThrow(ConflictException);
    });

    it("refuses after the term has ended", async () => {
      prisma.schoolClass.findFirst.mockResolvedValue(klass({ term: term({ endsOn: futureDate(-1) }) }));
      await expect(service.enroll(superAdmin, CLASS, { memberId: MEMBER })).rejects.toThrow(BadRequestException);
    });

    it("refuses a duplicate active enrollment", async () => {
      prisma.enrollment.findFirst.mockResolvedValue({ id: "e0" });
      await expect(service.enroll(superAdmin, CLASS, { memberId: MEMBER })).rejects.toThrow(ConflictException);
    });

    it("refuses enrolling the class's own teacher", async () => {
      prisma.classTeacher.findFirst.mockResolvedValue({ id: "t1" });
      await expect(service.enroll(superAdmin, CLASS, { memberId: MEMBER })).rejects.toThrow(BadRequestException);
    });

    it("completes an enrollment with a grade", async () => {
      prisma.enrollment.findFirst.mockResolvedValue({ id: ENROLLMENT, status: "ENROLLED", class: klass() });
      prisma.enrollment.update.mockResolvedValue({});
      await service.updateEnrollment(superAdmin, ENROLLMENT, { status: "COMPLETED", grade: "A" });
      expect(prisma.enrollment.update.mock.calls[0][0].data).toEqual({
        status: "COMPLETED",
        grade: "A",
        note: undefined,
        completedAt: expect.any(Date),
      });
    });

    it("drops an enrollment", async () => {
      prisma.enrollment.findFirst.mockResolvedValue({ id: ENROLLMENT, status: "ENROLLED", class: klass() });
      prisma.enrollment.update.mockResolvedValue({});
      await service.updateEnrollment(superAdmin, ENROLLMENT, { status: "DROPPED" });
      expect(prisma.enrollment.update.mock.calls[0][0].data).toMatchObject({ status: "DROPPED", droppedAt: expect.any(Date) });
    });

    it("only updates active enrollments", async () => {
      prisma.enrollment.findFirst.mockResolvedValue({ id: ENROLLMENT, status: "DROPPED", class: klass() });
      await expect(service.updateEnrollment(superAdmin, ENROLLMENT, { status: "COMPLETED" })).rejects.toThrow(BadRequestException);
    });
  });

  describe("stats", () => {
    it("reports active classes, students, and the 30-day attendance rate", async () => {
      prisma.schoolClass.count.mockResolvedValue(4);
      prisma.member.count.mockResolvedValue(25);
      prisma.sessionAttendance.groupBy.mockResolvedValue([
        { status: "PRESENT", _count: { _all: 9 } },
        { status: "ABSENT", _count: { _all: 1 } },
      ]);
      expect(await service.stats(superAdmin)).toEqual({ activeClasses: 4, students: 25, attendanceRate: 90 });
    });
  });
});
