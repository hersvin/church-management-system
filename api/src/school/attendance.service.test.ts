import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BRANCH_A, branchStaff, superAdmin } from "../test/actors";
import { createPrismaMock, type PrismaMock } from "../test/prisma-mock";
import { AttendanceService } from "./attendance.service";

const CLASS = "66666666-6666-4666-8666-666666666666";
const SESSION = "99999999-9999-4999-8999-999999999999";
const E1 = "88888888-8888-4888-8888-888888888881";
const E2 = "88888888-8888-4888-8888-888888888882";

const klass = {
  id: CLASS,
  deletedAt: null,
  term: { branchId: BRANCH_A, startsOn: new Date("2026-11-01T00:00:00Z"), endsOn: new Date("2027-02-28T00:00:00Z") },
};

describe("AttendanceService", () => {
  let prisma: PrismaMock;
  let audit: { record: ReturnType<typeof vi.fn> };
  let service: AttendanceService;

  beforeEach(() => {
    prisma = createPrismaMock();
    audit = { record: vi.fn() };
    service = new AttendanceService(prisma as never, audit as never);
    prisma.schoolClass.findFirst.mockResolvedValue(klass);
  });

  describe("createSession", () => {
    it("creates a session on a date inside the term", async () => {
      prisma.classSession.create.mockResolvedValue({ id: SESSION });
      await service.createSession(superAdmin, CLASS, { date: "2026-12-06", topic: "Creation" });
      expect(prisma.classSession.create.mock.calls[0][0].data).toEqual({
        classId: CLASS,
        date: new Date("2026-12-06T00:00:00.000Z"),
        topic: "Creation",
        notes: undefined,
      });
    });

    it("rejects a date outside the term", async () => {
      await expect(service.createSession(superAdmin, CLASS, { date: "2027-03-15" })).rejects.toThrow(BadRequestException);
    });

    it("turns a second session on the same date into a conflict", async () => {
      prisma.classSession.create.mockRejectedValue({ code: "P2002" });
      await expect(service.createSession(superAdmin, CLASS, { date: "2026-12-06" })).rejects.toThrow(ConflictException);
    });

    it("hides classes outside the actor's branch", async () => {
      prisma.schoolClass.findFirst.mockResolvedValue(null);
      await expect(service.createSession(branchStaff, CLASS, { date: "2026-12-06" })).rejects.toThrow(NotFoundException);
      expect(prisma.schoolClass.findFirst.mock.calls[0][0].where).toMatchObject({ term: { branchId: BRANCH_A } });
    });
  });

  describe("getSession", () => {
    it("builds the register from students not dropped before the date", async () => {
      const date = new Date("2026-12-06T00:00:00Z");
      prisma.classSession.findFirst.mockResolvedValue({ id: SESSION, classId: CLASS, date, class: klass });
      prisma.enrollment.findMany.mockResolvedValue([
        { id: E1, member: { id: "m1", firstName: "Ana", lastName: "Cruz" } },
        { id: E2, member: { id: "m2", firstName: "Ben", lastName: "Lim" } },
      ]);
      prisma.sessionAttendance.findMany.mockResolvedValue([{ enrollmentId: E1, status: "PRESENT", note: null }]);

      const result = await service.getSession(superAdmin, SESSION);

      expect(prisma.enrollment.findMany.mock.calls[0][0].where).toEqual({
        classId: CLASS,
        OR: [{ status: { not: "DROPPED" } }, { droppedAt: { gt: date } }],
      });
      expect(result.register.map((r) => [r.enrollmentId, r.status])).toEqual([
        [E1, "PRESENT"],
        [E2, null],
      ]);
    });
  });

  describe("saveAttendance", () => {
    beforeEach(() => {
      prisma.classSession.findFirst.mockResolvedValue({
        id: SESSION,
        classId: CLASS,
        date: new Date("2026-12-06T00:00:00Z"),
        class: klass,
      });
      prisma.enrollment.findMany.mockResolvedValue([{ id: E1 }, { id: E2 }]);
      prisma.sessionAttendance.upsert.mockResolvedValue({});
      prisma.sessionAttendance.findMany.mockResolvedValue([]);
    });

    it("upserts one record per student and audits the totals", async () => {
      await service.saveAttendance(superAdmin, SESSION, {
        records: [
          { enrollmentId: E1, status: "PRESENT" },
          { enrollmentId: E2, status: "ABSENT", note: "Sick" },
        ],
      });
      expect(prisma.sessionAttendance.upsert).toHaveBeenCalledTimes(2);
      expect(prisma.sessionAttendance.upsert.mock.calls[1][0]).toEqual({
        where: { sessionId_enrollmentId: { sessionId: SESSION, enrollmentId: E2 } },
        create: { sessionId: SESSION, enrollmentId: E2, status: "ABSENT", note: "Sick", recordedById: superAdmin.id },
        update: { status: "ABSENT", note: "Sick", recordedById: superAdmin.id, recordedAt: expect.any(Date) },
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "school.attendance", changes: { PRESENT: 1, ABSENT: 1 } }),
      );
    });

    it("rejects students who are not on this register", async () => {
      await expect(
        service.saveAttendance(superAdmin, SESSION, {
          records: [{ enrollmentId: "88888888-8888-4888-8888-000000000000", status: "PRESENT" }],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.sessionAttendance.upsert).not.toHaveBeenCalled();
    });
  });
});
