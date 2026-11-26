import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BRANCH_A, BRANCH_B, branchStaff, superAdmin } from "../test/actors";
import { createPrismaMock, type PrismaMock } from "../test/prisma-mock";
import { MinistriesService } from "./ministries.service";

const MINISTRY = "44444444-4444-4444-8444-444444444444";
const MEMBER = "55555555-5555-4555-8555-555555555555";
const ROLE = "66666666-6666-4666-8666-666666666666";

const ministry = { id: MINISTRY, branchId: BRANCH_A, isActive: true, deletedAt: null };

describe("MinistriesService", () => {
  let prisma: PrismaMock;
  let audit: { record: ReturnType<typeof vi.fn> };
  let service: MinistriesService;

  beforeEach(() => {
    prisma = createPrismaMock();
    audit = { record: vi.fn() };
    service = new MinistriesService(prisma as never, audit as never);
  });

  describe("list", () => {
    beforeEach(() => {
      prisma.ministry.findMany.mockResolvedValue([]);
      prisma.ministry.count.mockResolvedValue(0);
    });

    it("scopes to the actor's branch and filters by category and name", async () => {
      await service.list(branchStaff, { page: 1, pageSize: 20, category: "YOUTH", search: "teen", branchId: BRANCH_B });
      const args = prisma.ministry.findMany.mock.calls[0][0];
      expect(args.where).toEqual({
        deletedAt: null,
        branchId: BRANCH_A,
        category: "YOUTH",
        name: { contains: "teen", mode: "insensitive" },
      });
    });

    it("counts only active roster entries and includes leaders", async () => {
      await service.list(superAdmin, { page: 1, pageSize: 20 });
      const include = prisma.ministry.findMany.mock.calls[0][0].include;
      expect(include._count.select.members).toEqual({ where: { leftAt: null } });
      expect(include.members.where).toEqual({ leftAt: null, position: { in: ["LEADER", "COLEADER"] } });
    });
  });

  describe("get", () => {
    it("throws NotFound outside scope", async () => {
      prisma.ministry.findFirst.mockResolvedValue(null);
      await expect(service.get(branchStaff, MINISTRY)).rejects.toThrow(NotFoundException);
      expect(prisma.ministry.findFirst.mock.calls[0][0].where).toMatchObject({ id: MINISTRY, deletedAt: null, branchId: BRANCH_A });
    });

    it("returns only the active roster", async () => {
      prisma.ministry.findFirst.mockResolvedValue({ ...ministry, members: [], roles: [] });
      await service.get(superAdmin, MINISTRY);
      expect(prisma.ministry.findFirst.mock.calls[0][0].include.members.where).toEqual({ leftAt: null });
    });
  });

  describe("create and update", () => {
    it("forbids creating in another branch", async () => {
      await expect(service.create(branchStaff, { name: "Choir", category: "WORSHIP", branchId: BRANCH_B })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("creates and audits", async () => {
      prisma.ministry.create.mockResolvedValue({ id: MINISTRY });
      await service.create(superAdmin, { name: "Choir", category: "WORSHIP", branchId: BRANCH_A });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "ministries.create", entityId: MINISTRY }));
    });

    it("refuses to move a ministry with an active roster to another branch", async () => {
      prisma.ministry.findFirst.mockResolvedValue(ministry);
      prisma.ministryMember.count.mockResolvedValue(3);
      await expect(service.update(superAdmin, MINISTRY, { branchId: BRANCH_B })).rejects.toThrow(BadRequestException);
    });
  });

  describe("archive", () => {
    it("soft deletes the ministry and ends active roster entries", async () => {
      prisma.ministry.findFirst.mockResolvedValue(ministry);
      prisma.ministry.update.mockResolvedValue({});
      prisma.ministryMember.updateMany.mockResolvedValue({ count: 2 });
      await service.archive(superAdmin, MINISTRY);
      expect(prisma.ministryMember.updateMany).toHaveBeenCalledWith({
        where: { ministryId: MINISTRY, leftAt: null },
        data: { leftAt: expect.any(Date) },
      });
      expect(prisma.ministry.update).toHaveBeenCalledWith({
        where: { id: MINISTRY },
        data: { deletedAt: expect.any(Date), isActive: false },
      });
    });
  });

  describe("roles", () => {
    beforeEach(() => prisma.ministry.findFirst.mockResolvedValue(ministry));

    it("rejects a duplicate role name", async () => {
      prisma.ministryRole.findFirst.mockResolvedValue({ id: ROLE });
      await expect(service.addRole(superAdmin, MINISTRY, { name: "Vocalist" })).rejects.toThrow(ConflictException);
    });

    it("adds a role", async () => {
      prisma.ministryRole.findFirst.mockResolvedValue(null);
      prisma.ministryRole.create.mockResolvedValue({ id: ROLE, name: "Vocalist" });
      await service.addRole(superAdmin, MINISTRY, { name: "Vocalist" });
      expect(prisma.ministryRole.create).toHaveBeenCalledWith({ data: { name: "Vocalist", ministryId: MINISTRY } });
    });

    it("only removes roles that belong to the ministry", async () => {
      prisma.ministryRole.findFirst.mockResolvedValue(null);
      await expect(service.removeRole(superAdmin, MINISTRY, ROLE)).rejects.toThrow(NotFoundException);
      expect(prisma.ministryRole.findFirst.mock.calls[0][0].where).toEqual({ id: ROLE, ministryId: MINISTRY });
    });
  });

  describe("roster", () => {
    beforeEach(() => {
      prisma.ministry.findFirst.mockResolvedValue(ministry);
      prisma.member.findFirst.mockResolvedValue({ id: MEMBER, branchId: BRANCH_A });
      prisma.ministryMember.findFirst.mockResolvedValue(null);
      prisma.ministryMember.create.mockImplementation(async ({ data }) => ({ id: "mm1", ...data }));
    });

    it("adds a member with a position and role, and audits it", async () => {
      prisma.ministryRole.findFirst.mockResolvedValue({ id: ROLE });
      await service.addMember(superAdmin, MINISTRY, { memberId: MEMBER, position: "LEADER", ministryRoleId: ROLE });
      expect(prisma.ministryMember.create.mock.calls[0][0].data).toMatchObject({
        ministryId: MINISTRY,
        memberId: MEMBER,
        position: "LEADER",
        ministryRoleId: ROLE,
      });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "ministries.add_member" }));
    });

    it("rejects someone already on the active roster", async () => {
      prisma.ministryMember.findFirst.mockResolvedValue({ id: "mm0" });
      await expect(service.addMember(superAdmin, MINISTRY, { memberId: MEMBER, position: "MEMBER" })).rejects.toThrow(
        ConflictException,
      );
    });

    it("rejects a member from another branch", async () => {
      prisma.member.findFirst.mockResolvedValue({ id: MEMBER, branchId: BRANCH_B });
      await expect(service.addMember(superAdmin, MINISTRY, { memberId: MEMBER, position: "MEMBER" })).rejects.toThrow(
        BadRequestException,
      );
    });

    it("rejects adding people to an inactive ministry", async () => {
      prisma.ministry.findFirst.mockResolvedValue({ ...ministry, isActive: false });
      await expect(service.addMember(superAdmin, MINISTRY, { memberId: MEMBER, position: "MEMBER" })).rejects.toThrow(
        BadRequestException,
      );
    });

    it("rejects a role from a different ministry", async () => {
      prisma.ministryRole.findFirst.mockResolvedValue(null);
      await expect(
        service.addMember(superAdmin, MINISTRY, { memberId: MEMBER, position: "MEMBER", ministryRoleId: ROLE }),
      ).rejects.toThrow(BadRequestException);
    });

    it("updates the position of an active roster entry", async () => {
      prisma.ministryMember.findFirst.mockResolvedValue({ id: "mm1" });
      prisma.ministryMember.update.mockResolvedValue({});
      await service.updateMember(superAdmin, MINISTRY, MEMBER, { position: "COLEADER" });
      expect(prisma.ministryMember.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "mm1" }, data: { position: "COLEADER" } }),
      );
    });

    it("removing someone ends their entry instead of deleting it", async () => {
      prisma.ministryMember.findFirst.mockResolvedValue({ id: "mm1" });
      prisma.ministryMember.update.mockResolvedValue({});
      await service.removeMember(superAdmin, MINISTRY, MEMBER);
      expect(prisma.ministryMember.update).toHaveBeenCalledWith({ where: { id: "mm1" }, data: { leftAt: expect.any(Date) } });
      expect(prisma.ministryMember.delete).not.toHaveBeenCalled();
    });

    it("throws NotFound when removing someone not on the roster", async () => {
      prisma.ministryMember.findFirst.mockResolvedValue(null);
      await expect(service.removeMember(superAdmin, MINISTRY, MEMBER)).rejects.toThrow(NotFoundException);
    });
  });

  describe("forMember", () => {
    it("lists a member's current and past ministries in scope", async () => {
      prisma.member.findFirst.mockResolvedValue({ id: MEMBER, branchId: BRANCH_A });
      prisma.ministryMember.findMany.mockResolvedValue([]);
      await service.forMember(branchStaff, MEMBER);
      expect(prisma.member.findFirst.mock.calls[0][0].where).toMatchObject({ id: MEMBER, branchId: BRANCH_A });
      expect(prisma.ministryMember.findMany.mock.calls[0][0].where).toEqual({
        memberId: MEMBER,
        ministry: { deletedAt: null },
      });
    });
  });

  describe("stats", () => {
    it("counts active ministries and distinct active participants", async () => {
      prisma.ministry.count.mockResolvedValue(6);
      prisma.member.count.mockResolvedValue(14);
      expect(await service.stats(superAdmin)).toEqual({ ministries: 6, participants: 14 });
    });
  });
});
