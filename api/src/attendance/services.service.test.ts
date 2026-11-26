import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BRANCH_A, BRANCH_B, branchStaff, superAdmin } from "../test/actors";
import { createPrismaMock, type PrismaMock } from "../test/prisma-mock";
import { ServicesService } from "./services.service";

const SERVICE = "99999999-9999-4999-8999-999999999999";
const MEMBER = "33333333-3333-4333-8333-333333333333";

describe("ServicesService", () => {
  let prisma: PrismaMock;
  let audit: { record: ReturnType<typeof vi.fn> };
  let services: ServicesService;

  beforeEach(() => {
    prisma = createPrismaMock();
    audit = { record: vi.fn() };
    services = new ServicesService(prisma as never, audit as never);
  });

  describe("list", () => {
    it("pins branch users to their branch and reports attendance per service", async () => {
      prisma.service.findMany.mockResolvedValue([
        { id: SERVICE, name: "Sunday 9 AM", headcount: 200, startsAt: new Date() },
        { id: "s2", name: "Sunday 5 PM", headcount: null, startsAt: new Date() },
      ]);
      prisma.service.count.mockResolvedValue(2);
      prisma.checkIn.groupBy.mockResolvedValue([
        { serviceId: SERVICE, kind: "ATTENDEE", _count: { _all: 150 } },
        { serviceId: SERVICE, kind: "CHILD", _count: { _all: 20 } },
        { serviceId: "s2", kind: "ATTENDEE", _count: { _all: 40 } },
      ]);

      const result = await services.list(branchStaff, { page: 1, pageSize: 20, branchId: BRANCH_B });

      expect(prisma.service.findMany.mock.calls[0][0].where).toMatchObject({ branchId: BRANCH_A, deletedAt: null });
      expect(result.items.map((s) => [s.checkIns, s.children, s.attendance])).toEqual([
        [170, 20, 200],
        [40, 0, 40],
      ]);
      expect(result.total).toBe(2);
    });

    it("filters by a date range", async () => {
      prisma.service.findMany.mockResolvedValue([]);
      prisma.service.count.mockResolvedValue(0);
      prisma.checkIn.groupBy.mockResolvedValue([]);
      const from = new Date("2026-11-01T00:00:00Z");
      const to = new Date("2026-12-01T00:00:00Z");
      await services.list(superAdmin, { page: 1, pageSize: 20, from, to });
      expect(prisma.service.findMany.mock.calls[0][0].where.startsAt).toEqual({ gte: from, lt: to });
    });
  });

  describe("create", () => {
    it("refuses a branch user creating a service in another branch", async () => {
      await expect(
        services.create(branchStaff, { branchId: BRANCH_B, name: "Sunday 9 AM", startsAt: new Date() }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("creates and audits a service", async () => {
      prisma.branch.findUnique.mockResolvedValue({ id: BRANCH_A, isActive: true });
      prisma.service.create.mockResolvedValue({ id: SERVICE, branchId: BRANCH_A });
      const startsAt = new Date("2026-11-29T01:00:00Z");
      await services.create(superAdmin, { branchId: BRANCH_A, name: "Sunday 9 AM", startsAt, headcount: 180 });
      expect(prisma.service.create.mock.calls[0][0].data).toMatchObject({
        branchId: BRANCH_A,
        name: "Sunday 9 AM",
        startsAt,
        headcount: 180,
        createdById: superAdmin.id,
      });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "attendance.create_service", entityId: SERVICE }));
    });
  });

  describe("update and archive", () => {
    it("hides services outside the actor's branch", async () => {
      prisma.service.findFirst.mockResolvedValue(null);
      await expect(services.update(branchStaff, SERVICE, { headcount: 10 })).rejects.toThrow(NotFoundException);
      expect(prisma.service.findFirst.mock.calls[0][0].where).toMatchObject({ id: SERVICE, branchId: BRANCH_A, deletedAt: null });
    });

    it("archives with a timestamp instead of deleting", async () => {
      prisma.service.findFirst.mockResolvedValue({ id: SERVICE, branchId: BRANCH_A });
      prisma.service.update.mockResolvedValue({});
      await services.archive(superAdmin, SERVICE);
      expect(prisma.service.update.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
    });
  });

  describe("stats", () => {
    it("totals reported attendance per week and counts children still in care", async () => {
      const now = new Date("2026-11-25T04:00:00Z");
      vi.useFakeTimers({ now });
      try {
        prisma.service.findMany.mockResolvedValue([
          { id: "a", headcount: 200, startsAt: new Date("2026-11-22T01:00:00Z") },
          { id: "b", headcount: null, startsAt: new Date("2026-11-22T09:00:00Z") },
          { id: "c", headcount: 180, startsAt: new Date("2026-11-15T01:00:00Z") },
        ]);
        prisma.checkIn.groupBy.mockResolvedValue([
          { serviceId: "a", kind: "ATTENDEE", _count: { _all: 120 } },
          { serviceId: "a", kind: "CHILD", _count: { _all: 15 } },
          { serviceId: "b", kind: "ATTENDEE", _count: { _all: 60 } },
        ]);
        prisma.checkIn.count.mockResolvedValue(3);

        const result = await services.stats(superAdmin, { weeks: 2 });

        expect(result.weeks).toEqual([
          { weekOf: "2026-11-15", attendance: 180, checkIns: 0, children: 0, services: 1 },
          { weekOf: "2026-11-22", attendance: 260, checkIns: 195, children: 15, services: 2 },
        ]);
        expect(result.childrenInCare).toBe(3);
        expect(prisma.checkIn.count.mock.calls[0][0].where).toMatchObject({ kind: "CHILD", checkedOutAt: null });
      } finally {
        vi.useRealTimers();
      }
    });

    it("fills weeks without services with zero", async () => {
      vi.useFakeTimers({ now: new Date("2026-11-25T04:00:00Z") });
      try {
        prisma.service.findMany.mockResolvedValue([]);
        prisma.checkIn.groupBy.mockResolvedValue([]);
        prisma.checkIn.count.mockResolvedValue(0);
        const result = await services.stats(branchStaff, { weeks: 3 });
        expect(result.weeks.map((w) => [w.weekOf, w.attendance])).toEqual([
          ["2026-11-08", 0],
          ["2026-11-15", 0],
          ["2026-11-22", 0],
        ]);
        expect(prisma.service.findMany.mock.calls[0][0].where).toMatchObject({ branchId: BRANCH_A });
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("forMember", () => {
    it("returns a member's recent check-ins across services and events", async () => {
      prisma.member.findFirst.mockResolvedValue({ id: MEMBER, branchId: BRANCH_A });
      prisma.checkIn.findMany.mockResolvedValue([{ id: "x" }]);
      prisma.checkIn.count.mockResolvedValue(6);
      const result = await services.forMember(branchStaff, MEMBER);
      expect(prisma.member.findFirst.mock.calls[0][0].where).toMatchObject({ id: MEMBER, branchId: BRANCH_A, deletedAt: null });
      expect(prisma.checkIn.findMany.mock.calls[0][0].where).toEqual({ memberId: MEMBER });
      expect(result.recentCount).toBe(6);
    });
  });
});
