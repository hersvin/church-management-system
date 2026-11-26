import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "../auth/session-user";
import { createPrismaMock, type PrismaMock } from "../test/prisma-mock";
import { UsersService } from "./users.service";

const BRANCH_A = "11111111-1111-4111-8111-111111111111";
const BRANCH_B = "22222222-2222-4222-8222-222222222222";

const superAdmin: SessionUser = {
  id: "admin",
  email: "admin@church.org",
  firstName: "Super",
  lastName: "Admin",
  roleKey: "ADMIN",
  branchId: null,
  permissions: [],
};

// Admins and pastors are church-wide. A branch-scoped account that was granted user management stays inside its branch.
const branchAdmin: SessionUser = { ...superAdmin, id: "badmin", roleKey: "STAFF", branchId: BRANCH_A };

const input = {
  email: "leader@church.org",
  password: "Str0ng-password",
  firstName: "Ana",
  lastName: "Cruz",
  roleKey: "STAFF" as const,
  branchId: BRANCH_A,
};

describe("UsersService", () => {
  let prisma: PrismaMock;
  let audit: { record: ReturnType<typeof vi.fn> };
  let service: UsersService;

  beforeEach(() => {
    prisma = createPrismaMock();
    audit = { record: vi.fn() };
    service = new UsersService(prisma as never, audit as never);
  });

  describe("list", () => {
    beforeEach(() => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);
    });

    it("lists all branches for a super admin", async () => {
      await service.list(superAdmin, { page: 1, pageSize: 20 });
      expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({});
    });

    it("limits a branch-scoped manager to their own branch", async () => {
      await service.list(branchAdmin, { page: 1, pageSize: 20 });
      expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({ branchId: BRANCH_A });
    });

    it("never selects the password hash", async () => {
      await service.list(superAdmin, { page: 1, pageSize: 20 });
      expect(prisma.user.findMany.mock.calls[0][0].select.passwordHash).toBeUndefined();
    });
  });

  describe("create", () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.role.findUnique.mockResolvedValue({ id: "role-1", key: "STAFF" });
      prisma.user.create.mockImplementation(async ({ data }) => ({ id: "new", ...data }));
    });

    it("hashes the password and records an audit entry without it", async () => {
      const user = await service.create(superAdmin, input);
      const data = prisma.user.create.mock.calls[0][0].data;
      expect(data.passwordHash).not.toBe(input.password);
      expect(await bcrypt.compare(input.password, data.passwordHash)).toBe(true);
      expect(user).not.toHaveProperty("passwordHash");
      expect(JSON.stringify(audit.record.mock.calls[0][0])).not.toContain(input.password);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "users.create", actorId: "admin", entityId: "new" }),
      );
    });

    it("rejects a duplicate email", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "existing" });
      await expect(service.create(superAdmin, input)).rejects.toThrow(ConflictException);
    });

    it("stops a branch-scoped manager from creating users in another branch", async () => {
      await expect(service.create(branchAdmin, { ...input, branchId: BRANCH_B })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("stops a branch-scoped manager from creating an admin", async () => {
      await expect(service.create(branchAdmin, { ...input, roleKey: "ADMIN" })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("update", () => {
    beforeEach(() => {
      prisma.role.findUnique.mockResolvedValue({ id: "role-2", key: "PASTOR" });
      prisma.user.update.mockImplementation(async ({ data }) => ({ id: "u2", ...data }));
    });

    it("throws NotFound for a missing user", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.update(superAdmin, "u2", { isActive: false })).rejects.toThrow(NotFoundException);
    });

    it("hides users of other branches from a branch-scoped manager", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "u2", branchId: BRANCH_B, role: { key: "STAFF" } });
      await expect(service.update(branchAdmin, "u2", { isActive: false })).rejects.toThrow(NotFoundException);
    });

    it("revokes sessions when deactivating or changing role", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "u2", branchId: BRANCH_A, role: { key: "STAFF" } });
      await service.update(superAdmin, "u2", { roleKey: "PASTOR" });
      const data = prisma.user.update.mock.calls[0][0].data;
      expect(data.tokenVersion).toEqual({ increment: 1 });
      expect(data.roleId).toBe("role-2");
    });

    it("links the account to a member record, revoking sessions so old cards stop working", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "u2", branchId: BRANCH_A, role: { key: "MEMBER" } });
      prisma.member.findFirst.mockResolvedValue({ id: "m1" });
      await service.update(superAdmin, "u2", { memberId: "33333333-3333-4333-8333-333333333333" });
      expect(prisma.member.findFirst.mock.calls[0][0].where).toEqual({ id: "33333333-3333-4333-8333-333333333333", deletedAt: null });
      const data = prisma.user.update.mock.calls[0][0].data;
      expect(data.memberId).toBe("33333333-3333-4333-8333-333333333333");
      expect(data.tokenVersion).toEqual({ increment: 1 });
    });

    it("refuses an unknown member, or one already linked to another account", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "u2", branchId: BRANCH_A, role: { key: "MEMBER" } });
      prisma.member.findFirst.mockResolvedValue(null);
      await expect(service.update(superAdmin, "u2", { memberId: "33333333-3333-4333-8333-333333333333" })).rejects.toThrow(/member not found/i);
      prisma.member.findFirst.mockResolvedValue({ id: "m1" });
      prisma.user.update.mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" }));
      await expect(service.update(superAdmin, "u2", { memberId: "33333333-3333-4333-8333-333333333333" })).rejects.toThrow(/already linked/);
    });

    it("does not revoke sessions for a name change", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "u2", branchId: BRANCH_A, role: { key: "STAFF" } });
      await service.update(superAdmin, "u2", { firstName: "Bea" });
      expect(prisma.user.update.mock.calls[0][0].data.tokenVersion).toBeUndefined();
    });

    it("stops a user from deactivating themselves", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "admin", branchId: null, role: { key: "ADMIN" } });
      await expect(service.update(superAdmin, "admin", { isActive: false })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
