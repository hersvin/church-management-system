import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BRANCH_A, BRANCH_B, branchStaff, superAdmin } from "../test/actors";
import { createPrismaMock, type PrismaMock } from "../test/prisma-mock";
import { MembersService } from "./members.service";

const HOUSEHOLD = "33333333-3333-4333-8333-333333333333";

describe("MembersService", () => {
  let prisma: PrismaMock;
  let audit: { record: ReturnType<typeof vi.fn> };
  let service: MembersService;

  beforeEach(() => {
    prisma = createPrismaMock();
    audit = { record: vi.fn() };
    service = new MembersService(prisma as never, audit as never);
    prisma.member.findMany.mockResolvedValue([]);
    prisma.member.count.mockResolvedValue(0);
  });

  describe("list", () => {
    it("excludes archived members and paginates", async () => {
      await service.list(superAdmin, { page: 3, pageSize: 10 });
      const args = prisma.member.findMany.mock.calls[0][0];
      expect(args.where.deletedAt).toBeNull();
      expect(args.skip).toBe(20);
      expect(args.take).toBe(10);
    });

    it("limits branch users to their branch even if another is requested", async () => {
      await service.list(branchStaff, { page: 1, pageSize: 20, branchId: BRANCH_B });
      expect(prisma.member.findMany.mock.calls[0][0].where.branchId).toBe(BRANCH_A);
    });

    it("lets church-wide users filter by branch", async () => {
      await service.list(superAdmin, { page: 1, pageSize: 20, branchId: BRANCH_B });
      expect(prisma.member.findMany.mock.calls[0][0].where.branchId).toBe(BRANCH_B);
    });

    it("searches names, email, and phone case-insensitively", async () => {
      await service.list(superAdmin, { page: 1, pageSize: 20, search: "cruz" });
      const or = prisma.member.findMany.mock.calls[0][0].where.AND[0].OR;
      expect(or).toEqual(
        expect.arrayContaining([
          { firstName: { contains: "cruz", mode: "insensitive" } },
          { lastName: { contains: "cruz", mode: "insensitive" } },
          { email: { contains: "cruz", mode: "insensitive" } },
          { phone: { contains: "cruz" } },
        ]),
      );
    });

    it("filters by status", async () => {
      await service.list(superAdmin, { page: 1, pageSize: 20, status: "MEMBER" });
      expect(prisma.member.findMany.mock.calls[0][0].where.status).toBe("MEMBER");
    });
  });

  describe("get", () => {
    it("throws NotFound for an archived member", async () => {
      prisma.member.findFirst.mockResolvedValue(null);
      await expect(service.get(superAdmin, "m1")).rejects.toThrow(NotFoundException);
      expect(prisma.member.findFirst.mock.calls[0][0].where).toMatchObject({ id: "m1", deletedAt: null });
    });

    it("scopes lookups to the actor's branch", async () => {
      prisma.member.findFirst.mockResolvedValue(null);
      await expect(service.get(branchStaff, "m1")).rejects.toThrow(NotFoundException);
      expect(prisma.member.findFirst.mock.calls[0][0].where.branchId).toBe(BRANCH_A);
    });
  });

  describe("create", () => {
    const input = {
      firstName: "Ana",
      lastName: "Cruz",
      gender: "FEMALE" as const,
      status: "VISITOR" as const,
      branchId: BRANCH_A,
    };

    beforeEach(() => {
      prisma.member.create.mockImplementation(async ({ data }) => ({ id: "m1", ...data }));
    });

    it("creates the member with an initial status history entry and audits it", async () => {
      await service.create(superAdmin, input);
      const data = prisma.member.create.mock.calls[0][0].data;
      expect(data.statusHistory.create).toEqual({ fromStatus: null, toStatus: "VISITOR", changedById: superAdmin.id });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "members.create", entityId: "m1" }));
    });

    it("forbids creating members in another branch", async () => {
      await expect(service.create(branchStaff, { ...input, branchId: BRANCH_B })).rejects.toThrow(ForbiddenException);
    });

    it("rejects a household from a different branch", async () => {
      prisma.household.findFirst.mockResolvedValue({ id: HOUSEHOLD, branchId: BRANCH_B });
      await expect(
        service.create(superAdmin, { ...input, householdId: HOUSEHOLD, householdRole: "CHILD" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects a missing household", async () => {
      prisma.household.findFirst.mockResolvedValue(null);
      await expect(
        service.create(superAdmin, { ...input, householdId: HOUSEHOLD, householdRole: "CHILD" }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("update", () => {
    const existing = { id: "m1", branchId: BRANCH_A, status: "VISITOR", householdId: null };

    beforeEach(() => {
      prisma.member.findFirst.mockResolvedValue(existing);
      prisma.member.update.mockImplementation(async ({ data }) => ({ ...existing, ...data }));
    });

    it("records status history with a note when the status changes", async () => {
      await service.update(superAdmin, "m1", { status: "MEMBER", statusNote: "Finished membership class" });
      const data = prisma.member.update.mock.calls[0][0].data;
      expect(data.status).toBe("MEMBER");
      expect(data.statusNote).toBeUndefined();
      expect(data.statusHistory.create).toEqual({
        fromStatus: "VISITOR",
        toStatus: "MEMBER",
        note: "Finished membership class",
        changedById: superAdmin.id,
      });
    });

    it("does not add history when the status is unchanged", async () => {
      await service.update(superAdmin, "m1", { status: "VISITOR", phone: "123" });
      expect(prisma.member.update.mock.calls[0][0].data.statusHistory).toBeUndefined();
    });

    it("clears the household role when leaving a household", async () => {
      await service.update(superAdmin, "m1", { householdId: null });
      expect(prisma.member.update.mock.calls[0][0].data.householdRole).toBeNull();
    });

    it("forbids moving a member to another branch for branch users", async () => {
      await expect(service.update(branchStaff, "m1", { branchId: BRANCH_B })).rejects.toThrow(ForbiddenException);
    });
  });

  describe("archive", () => {
    it("soft deletes and audits", async () => {
      prisma.member.findFirst.mockResolvedValue({ id: "m1", branchId: BRANCH_A });
      prisma.member.update.mockResolvedValue({});
      await service.archive(superAdmin, "m1");
      expect(prisma.member.update).toHaveBeenCalledWith({
        where: { id: "m1" },
        data: { deletedAt: expect.any(Date) },
      });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "members.archive" }));
    });
  });

  describe("stats", () => {
    it("returns counts per status, total, and new this month", async () => {
      prisma.member.groupBy.mockResolvedValue([
        { status: "MEMBER", _count: { _all: 7 } },
        { status: "VISITOR", _count: { _all: 3 } },
      ]);
      prisma.member.count.mockResolvedValue(2);
      prisma.household.count.mockResolvedValue(4);
      expect(await service.stats(superAdmin)).toEqual({
        total: 10,
        byStatus: { VISITOR: 3, REGULAR: 0, MEMBER: 7, INACTIVE: 0 },
        newThisMonth: 2,
        households: 4,
      });
    });
  });
});
