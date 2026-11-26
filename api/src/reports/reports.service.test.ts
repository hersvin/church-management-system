import { BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BRANCH_A, BRANCH_B, branchStaff, superAdmin } from "../test/actors";
import { createPrismaMock, type PrismaMock } from "../test/prisma-mock";
import { ReportsService } from "./reports.service";

// 2026-11-25 10:00 in Manila.
const NOW = new Date("2026-11-25T02:00:00Z");
const RANGE = { from: "2026-11-01", to: "2026-11-30" };
const START = new Date("2026-10-31T16:00:00Z");
const END = new Date("2026-11-30T16:00:00Z");
const main = { name: "Main" };

describe("ReportsService", () => {
  let prisma: PrismaMock;
  let audit: { record: ReturnType<typeof vi.fn> };
  let reports: ReportsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    audit = { record: vi.fn() };
    reports = new ReportsService(prisma as never, audit as never);
  });

  it("rejects an invalid resolved range with 400", async () => {
    await expect(reports.build(superAdmin, "attendance", { from: "2026-12-01" }, NOW)).rejects.toThrow(BadRequestException);
  });

  describe("attendance", () => {
    it("pins branch users to their branch and joins check-in counts", async () => {
      prisma.service.findMany.mockResolvedValue([
        { id: "s1", name: "9 AM", startsAt: new Date("2026-11-22T01:00:00Z"), headcount: 100, branch: main },
      ]);
      prisma.checkIn.groupBy.mockResolvedValue([
        { serviceId: "s1", kind: "ATTENDEE", _count: { _all: 40 } },
        { serviceId: "s1", kind: "CHILD", _count: { _all: 6 } },
      ]);

      const report = await reports.build(branchStaff, "attendance", { ...RANGE, branchId: BRANCH_B }, NOW);

      expect(prisma.service.findMany.mock.calls[0][0].where).toEqual({
        branchId: BRANCH_A,
        deletedAt: null,
        startsAt: { gte: START, lt: END },
      });
      expect(report).toMatchObject({ kind: "attendance", from: "2026-11-01", to: "2026-11-30", branchId: BRANCH_A });
      expect(report.rows).toEqual([
        { date: "2026-11-22 09:00", service: "9 AM", branch: "Main", headcount: 100, checkIns: 46, children: 6, attendance: 100 },
      ]);
    });

    it("skips the check-in query when there are no services", async () => {
      prisma.service.findMany.mockResolvedValue([]);
      const report = await reports.build(superAdmin, "attendance", RANGE, NOW);
      expect(prisma.checkIn.groupBy).not.toHaveBeenCalled();
      expect(report.branchId).toBeNull();
    });
  });

  describe("membership", () => {
    it("reads people touched in the range and current status totals", async () => {
      prisma.member.findMany.mockResolvedValue([
        { createdAt: new Date("2026-11-03T02:00:00Z"), membershipDate: null, baptismDate: null },
      ]);
      prisma.member.groupBy.mockResolvedValue([
        { status: "MEMBER", _count: { _all: 12 } },
        { status: "VISITOR", _count: { _all: 3 } },
      ]);

      const report = await reports.build(superAdmin, "membership", { ...RANGE, branchId: BRANCH_B }, NOW);

      const where = prisma.member.findMany.mock.calls[0][0].where;
      expect(where).toMatchObject({ branchId: BRANCH_B, deletedAt: null });
      expect(where.OR).toEqual([
        { createdAt: { gte: START, lt: END } },
        { membershipDate: { gte: new Date("2026-11-01T00:00:00Z"), lte: new Date("2026-11-30T00:00:00Z") } },
        { baptismDate: { gte: new Date("2026-11-01T00:00:00Z"), lte: new Date("2026-11-30T00:00:00Z") } },
      ]);
      expect(report.rows).toEqual([{ month: "2026-11", newPeople: 1, newMembers: 0, baptisms: 0 }]);
      expect(report.summary.find((s) => s.label === "Members now")?.value).toBe(12);
      expect(report.summary.find((s) => s.label === "Regulars now")?.value).toBe(0);
    });
  });

  describe("ministries", () => {
    it("reads rosters overlapping the range and counts active people", async () => {
      prisma.ministry.findMany.mockResolvedValue([{ id: "m1", name: "Worship", category: "WORSHIP", branch: main }]);
      prisma.ministryMember.findMany.mockResolvedValue([
        { ministryId: "m1", memberId: "a", position: "LEADER", joinedAt: new Date("2025-01-01T00:00:00Z"), leftAt: null },
      ]);
      prisma.member.count.mockResolvedValue(4);

      const report = await reports.build(branchStaff, "ministries", RANGE, NOW);

      expect(prisma.ministryMember.findMany.mock.calls[0][0].where).toEqual({
        ministry: { branchId: BRANCH_A, deletedAt: null },
        joinedAt: { lt: END },
        OR: [{ leftAt: null }, { leftAt: { gte: START } }],
      });
      expect(prisma.member.count.mock.calls[0][0].where).toEqual({ branchId: BRANCH_A, deletedAt: null, status: { not: "INACTIVE" } });
      expect(report.summary.find((s) => s.label === "Share of people serving")?.value).toBe(25);
    });
  });

  describe("events", () => {
    it("joins active registrations and check-ins per event", async () => {
      prisma.event.findMany.mockResolvedValue([
        { id: "e1", title: "Food Drive", category: "OUTREACH", status: "SCHEDULED", capacity: 40, startsAt: new Date("2026-11-20T10:00:00Z"), branch: main },
      ]);
      prisma.eventRegistration.groupBy.mockResolvedValue([{ eventId: "e1", _count: { _all: 20 } }]);
      prisma.checkIn.groupBy.mockResolvedValue([{ eventId: "e1", _count: { _all: 15 } }]);

      const report = await reports.build(superAdmin, "events", RANGE, NOW);

      expect(prisma.event.findMany.mock.calls[0][0].where).toEqual({ startsAt: { gte: START, lt: END } });
      expect(prisma.eventRegistration.groupBy.mock.calls[0][0].where).toEqual({ eventId: { in: ["e1"] }, cancelledAt: null });
      expect(report.rows[0]).toMatchObject({ registered: 20, checkedIn: 15, turnout: 75, fill: 50 });
    });
  });

  describe("rooms", () => {
    it("reads approved bookings overlapping the range and converts rates to numbers", async () => {
      prisma.room.findMany.mockResolvedValue([
        { id: "r1", name: "Sanctuary", capacity: 300, hourlyRate: { toString: () => "6000.00" }, branch: main },
      ]);
      prisma.roomBooking.findMany.mockResolvedValue([
        { roomId: "r1", startsAt: new Date("2026-11-22T01:00:00Z"), endsAt: new Date("2026-11-22T03:00:00Z") },
      ]);

      const report = await reports.build(superAdmin, "rooms", RANGE, NOW);

      expect(prisma.room.findMany.mock.calls[0][0].where).toEqual({ deletedAt: null, isActive: true });
      expect(prisma.roomBooking.findMany.mock.calls[0][0].where).toEqual({
        status: "APPROVED",
        roomId: { in: ["r1"] },
        startsAt: { lt: END },
        endsAt: { gt: START },
      });
      expect(report.rows[0]).toMatchObject({ room: "Sanctuary", hours: 2, hourlyRate: 6000, value: 12000 });
    });
  });

  describe("exportCsv", () => {
    it("returns a named CSV with a byte order mark and audits the export without rows", async () => {
      prisma.service.findMany.mockResolvedValue([
        { id: "s1", name: "=9 AM", startsAt: new Date("2026-11-22T01:00:00Z"), headcount: 10, branch: main },
      ]);
      prisma.checkIn.groupBy.mockResolvedValue([]);

      const file = await reports.exportCsv(branchStaff, "attendance", RANGE, NOW);

      expect(file.filename).toBe("attendance-2026-11-01-to-2026-11-30.csv");
      expect(file.body.startsWith("﻿Date,Service,")).toBe(true);
      expect(file.body).toContain("'=9 AM");
      expect(audit.record).toHaveBeenCalledWith({
        actorId: branchStaff.id,
        action: "reports.export",
        entity: "report",
        entityId: "attendance",
        branchId: BRANCH_A,
        changes: { from: "2026-11-01", to: "2026-11-30", rows: 1 },
      });
    });
  });
});
