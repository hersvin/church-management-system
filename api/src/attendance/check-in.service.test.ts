import { BadRequestException, ConflictException, ForbiddenException, HttpException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BRANCH_A, branchStaff, superAdmin } from "../test/actors";
import { createPrismaMock, type PrismaMock } from "../test/prisma-mock";
import { CheckInService } from "./check-in.service";

const SERVICE = "99999999-9999-4999-8999-999999999999";
const EVENT = "77777777-7777-4777-8777-777777777777";
const CHILD = "33333333-3333-4333-8333-333333333331";
const PARENT = "33333333-3333-4333-8333-333333333332";
const STRANGER = "33333333-3333-4333-8333-333333333339";
const HOUSEHOLD = "44444444-4444-4444-8444-444444444444";
const CHECK_IN = "55555555-5555-4555-8555-555555555555";

const service = { id: SERVICE, branchId: BRANCH_A, startsAt: new Date("2026-11-29T01:00:00Z"), headcount: null, deletedAt: null };
const staffWithAttendance = { ...branchStaff, permissions: ["attendance.read", "attendance.manage"] };
const pastor = { ...staffWithAttendance, roleKey: "PASTOR" as const, permissions: ["attendance.manage", "attendance.override"] };

const childCheckIn = {
  id: CHECK_IN,
  kind: "CHILD",
  branchId: BRANCH_A,
  serviceId: SERVICE,
  eventId: null,
  memberId: CHILD,
  guardianMemberId: PARENT,
  guardianName: null,
  pickupCode: "K7RQX",
  failedPickupAttempts: 0,
  checkedOutAt: null,
  member: { id: CHILD, householdId: HOUSEHOLD },
};

describe("CheckInService", () => {
  let prisma: PrismaMock;
  let audit: { record: ReturnType<typeof vi.fn> };
  let checkIns: CheckInService;

  beforeEach(() => {
    prisma = createPrismaMock();
    audit = { record: vi.fn() };
    checkIns = new CheckInService(prisma as never, audit as never);
    prisma.service.findFirst.mockResolvedValue(service);
    prisma.member.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      branchId: BRANCH_A,
      householdId: where.id === STRANGER ? null : HOUSEHOLD,
    }));
    prisma.checkIn.findFirst.mockResolvedValue(null);
    prisma.checkIn.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: CHECK_IN, ...data }));
  });

  describe("checkIn", () => {
    it("checks a member in to a service in the actor's branch", async () => {
      await checkIns.checkIn(staffWithAttendance, { type: "service", id: SERVICE }, { kind: "ATTENDEE", memberId: PARENT });
      expect(prisma.service.findFirst.mock.calls[0][0].where).toMatchObject({ id: SERVICE, deletedAt: null, branchId: BRANCH_A });
      expect(prisma.checkIn.create.mock.calls[0][0].data).toMatchObject({
        kind: "ATTENDEE",
        branchId: BRANCH_A,
        serviceId: SERVICE,
        memberId: PARENT,
        checkedInById: staffWithAttendance.id,
      });
    });

    it("returns the person's name so the station can confirm who was checked in", async () => {
      await checkIns.checkIn(superAdmin, { type: "service", id: SERVICE }, { kind: "ATTENDEE", memberId: PARENT });
      await checkIns.checkIn(superAdmin, { type: "service", id: SERVICE }, { kind: "CHILD", memberId: CHILD, guardianMemberId: PARENT });
      for (const [args] of prisma.checkIn.create.mock.calls) {
        expect(args.include).toEqual({ member: { select: { id: true, firstName: true, lastName: true } } });
      }
    });

    it("hides services outside the actor's branch", async () => {
      prisma.service.findFirst.mockResolvedValue(null);
      await expect(
        checkIns.checkIn(staffWithAttendance, { type: "service", id: SERVICE }, { kind: "ATTENDEE", guestName: "Rosa" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("refuses a member from another branch", async () => {
      prisma.member.findFirst.mockResolvedValue(null);
      await expect(
        checkIns.checkIn(superAdmin, { type: "service", id: SERVICE }, { kind: "ATTENDEE", memberId: PARENT }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.member.findFirst.mock.calls[0][0].where).toMatchObject({ id: PARENT, branchId: BRANCH_A, deletedAt: null });
    });

    it("refuses a second check-in for the same member", async () => {
      prisma.checkIn.findFirst.mockResolvedValue({ id: "existing" });
      await expect(
        checkIns.checkIn(superAdmin, { type: "service", id: SERVICE }, { kind: "ATTENDEE", memberId: PARENT }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.checkIn.create).not.toHaveBeenCalled();
    });

    it("gives a child a pickup code once and keeps it out of the audit log", async () => {
      const result = await checkIns.checkIn(
        staffWithAttendance,
        { type: "service", id: SERVICE },
        { kind: "CHILD", memberId: CHILD, guardianMemberId: PARENT, careNote: "Peanut allergy" },
      );
      expect(result.pickupCode).toMatch(/^[ACDEFGHJKMNPQRTUVWXY34679]{5}$/);
      expect(prisma.checkIn.create.mock.calls[0][0].data).toMatchObject({
        kind: "CHILD",
        guardianMemberId: PARENT,
        careNote: "Peanut allergy",
      });
      expect(JSON.stringify(audit.record.mock.calls)).not.toContain(result.pickupCode);
    });

    it("draws a new code when the first collides with a child still in care", async () => {
      prisma.checkIn.create.mockRejectedValueOnce({ code: "P2002" });
      const result = await checkIns.checkIn(
        superAdmin,
        { type: "service", id: SERVICE },
        { kind: "CHILD", memberId: CHILD, guardianMemberId: PARENT },
      );
      expect(prisma.checkIn.create).toHaveBeenCalledTimes(2);
      expect(result.pickupCode).toBeDefined();
    });

    it("checks in to a scheduled event and refuses a cancelled one", async () => {
      prisma.event.findFirst.mockResolvedValue({ id: EVENT, branchId: BRANCH_A, startsAt: new Date(), status: "SCHEDULED" });
      await checkIns.checkIn(superAdmin, { type: "event", id: EVENT }, { kind: "ATTENDEE", guestName: "Rosa Diaz" });
      expect(prisma.checkIn.create.mock.calls[0][0].data).toMatchObject({ eventId: EVENT, guestName: "Rosa Diaz" });

      prisma.event.findFirst.mockResolvedValue({ id: EVENT, branchId: BRANCH_A, startsAt: new Date(), status: "CANCELLED" });
      await expect(
        checkIns.checkIn(superAdmin, { type: "event", id: EVENT }, { kind: "ATTENDEE", guestName: "Rosa Diaz" }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("list", () => {
    it("never returns pickup codes", async () => {
      prisma.checkIn.findMany.mockResolvedValue([]);
      prisma.eventRegistration.findMany.mockResolvedValue([]);
      await checkIns.list(superAdmin, { type: "service", id: SERVICE });
      const select = prisma.checkIn.findMany.mock.calls[0][0].select;
      expect(select.pickupCode).toBeUndefined();
      expect(select.id).toBe(true);
    });

    it("marks which event check-ins were registered", async () => {
      prisma.event.findFirst.mockResolvedValue({ id: EVENT, branchId: BRANCH_A, startsAt: new Date(), status: "SCHEDULED" });
      prisma.checkIn.findMany.mockResolvedValue([
        { id: "a", kind: "ATTENDEE", memberId: PARENT, checkedOutAt: null, failedPickupAttempts: 0 },
        { id: "b", kind: "ATTENDEE", memberId: STRANGER, checkedOutAt: null, failedPickupAttempts: 0 },
      ]);
      prisma.eventRegistration.findMany.mockResolvedValue([{ memberId: PARENT }]);
      const result = await checkIns.list(superAdmin, { type: "event", id: EVENT });
      expect(result.items.map((i) => i.registered)).toEqual([true, false]);
      expect(result.registered).toBe(1);
    });
  });

  describe("checkOut", () => {
    beforeEach(() => {
      prisma.checkIn.findFirst.mockResolvedValue(childCheckIn);
      prisma.member.findMany.mockResolvedValue([{ id: PARENT, firstName: "Ana", lastName: "Cruz", householdRole: "HEAD" }]);
      prisma.checkIn.updateMany.mockResolvedValue({ count: 1 });
      prisma.checkIn.update.mockResolvedValue({});
    });

    it("releases a child to an authorized guardian with the right code", async () => {
      await checkIns.checkOut(staffWithAttendance, CHECK_IN, { method: "CODE", code: "K7RQX", pickedUpByMemberId: PARENT });
      expect(prisma.checkIn.findFirst.mock.calls[0][0].where).toMatchObject({ id: CHECK_IN, branchId: BRANCH_A });
      const update = prisma.checkIn.updateMany.mock.calls[0][0];
      expect(update.where).toEqual({ id: CHECK_IN, checkedOutAt: null });
      expect(update.data).toMatchObject({ pickedUpByMemberId: PARENT, checkedOutById: staffWithAttendance.id });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "attendance.check_out" }));
    });

    it("counts a wrong code and refuses the release", async () => {
      await expect(
        checkIns.checkOut(staffWithAttendance, CHECK_IN, { method: "CODE", code: "AAAAA", pickedUpByMemberId: PARENT }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.checkIn.update.mock.calls[0][0].data).toEqual({ failedPickupAttempts: { increment: 1 } });
      expect(prisma.checkIn.updateMany).not.toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "attendance.pickup_failed" }));
    });

    it("locks after too many wrong codes, even for the right one", async () => {
      prisma.checkIn.findFirst.mockResolvedValue({ ...childCheckIn, failedPickupAttempts: 5 });
      const attempt = checkIns.checkOut(staffWithAttendance, CHECK_IN, { method: "CODE", code: "K7RQX", pickedUpByMemberId: PARENT });
      await expect(attempt).rejects.toThrow(HttpException);
      await expect(attempt).rejects.toMatchObject({ status: 423 });
    });

    it("refuses someone who is not a guardian of the child", async () => {
      await expect(
        checkIns.checkOut(staffWithAttendance, CHECK_IN, { method: "CODE", code: "K7RQX", pickedUpByMemberId: STRANGER }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.checkIn.updateMany).not.toHaveBeenCalled();
    });

    it("accepts a non-member guardian only under the name given at check-in", async () => {
      prisma.checkIn.findFirst.mockResolvedValue({ ...childCheckIn, guardianMemberId: null, guardianName: "Lola Cruz" });
      await checkIns.checkOut(staffWithAttendance, CHECK_IN, { method: "CODE", code: "K7RQX", pickedUpByName: "lola  cruz" });
      await expect(
        checkIns.checkOut(staffWithAttendance, CHECK_IN, { method: "CODE", code: "K7RQX", pickedUpByName: "Someone Else" }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("lets only users with the override permission release without a code", async () => {
      const input = { method: "OVERRIDE" as const, reason: "Tag lost; ID checked", pickedUpByMemberId: STRANGER };
      await expect(checkIns.checkOut(staffWithAttendance, CHECK_IN, input)).rejects.toThrow(ForbiddenException);
      await checkIns.checkOut(pastor, CHECK_IN, input);
      expect(prisma.checkIn.updateMany.mock.calls[0][0].data).toMatchObject({ overrideReason: "Tag lost; ID checked" });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "attendance.pickup_override" }));
    });

    it("refuses a second checkout", async () => {
      prisma.checkIn.findFirst.mockResolvedValue({ ...childCheckIn, checkedOutAt: new Date() });
      await expect(
        checkIns.checkOut(staffWithAttendance, CHECK_IN, { method: "CODE", code: "K7RQX", pickedUpByMemberId: PARENT }),
      ).rejects.toThrow(ConflictException);
    });

    it("refuses checkout for an adult check-in", async () => {
      prisma.checkIn.findFirst.mockResolvedValue({ ...childCheckIn, kind: "ATTENDEE" });
      await expect(
        checkIns.checkOut(staffWithAttendance, CHECK_IN, { method: "CODE", code: "K7RQX", pickedUpByMemberId: PARENT }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("guardians", () => {
    it("lists the recorded guardian and the household heads and spouses", async () => {
      prisma.checkIn.findFirst.mockResolvedValue(childCheckIn);
      prisma.member.findMany.mockResolvedValue([
        { id: PARENT, firstName: "Ana", lastName: "Cruz", householdRole: "HEAD" },
        { id: "spouse", firstName: "Ben", lastName: "Cruz", householdRole: "SPOUSE" },
      ]);
      const result = await checkIns.guardians(superAdmin, CHECK_IN);
      expect(prisma.member.findMany.mock.calls[0][0].where).toMatchObject({
        deletedAt: null,
        OR: [{ id: { in: [PARENT] } }, { householdId: HOUSEHOLD, householdRole: { in: ["HEAD", "SPOUSE"] } }],
      });
      expect(result.members.map((m) => m.id)).toEqual([PARENT, "spouse"]);
    });
  });

  describe("undo", () => {
    it("deletes a mistaken check-in", async () => {
      prisma.checkIn.findFirst.mockResolvedValue({ ...childCheckIn, kind: "ATTENDEE" });
      await checkIns.undo(superAdmin, CHECK_IN);
      expect(prisma.checkIn.delete).toHaveBeenCalledWith({ where: { id: CHECK_IN } });
    });

    it("keeps the record of a child already collected", async () => {
      prisma.checkIn.findFirst.mockResolvedValue({ ...childCheckIn, checkedOutAt: new Date() });
      await expect(checkIns.undo(superAdmin, CHECK_IN)).rejects.toThrow(ConflictException);
    });

    it("hides check-ins of other branches", async () => {
      await expect(checkIns.undo(staffWithAttendance, CHECK_IN)).rejects.toThrow(NotFoundException);
      expect(prisma.checkIn.findFirst.mock.calls[0][0].where).toMatchObject({ branchId: BRANCH_A });
    });
  });
});
