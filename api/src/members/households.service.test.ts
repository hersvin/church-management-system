import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BRANCH_A, BRANCH_B, branchStaff, superAdmin } from "../test/actors";
import { createPrismaMock, type PrismaMock } from "../test/prisma-mock";
import { HouseholdsService } from "./households.service";

describe("HouseholdsService", () => {
  let prisma: PrismaMock;
  let audit: { record: ReturnType<typeof vi.fn> };
  let service: HouseholdsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    audit = { record: vi.fn() };
    service = new HouseholdsService(prisma as never, audit as never);
  });

  it("lists active households in scope with member counts", async () => {
    prisma.household.findMany.mockResolvedValue([]);
    prisma.household.count.mockResolvedValue(0);
    await service.list(branchStaff, { page: 1, pageSize: 20, search: "cruz" });
    const args = prisma.household.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({
      deletedAt: null,
      branchId: BRANCH_A,
      name: { contains: "cruz", mode: "insensitive" },
    });
    expect(args.include._count.select.members).toEqual({ where: { deletedAt: null } });
  });

  it("returns a household with its active members", async () => {
    prisma.household.findFirst.mockResolvedValue({ id: "h1", members: [] });
    await service.get(superAdmin, "h1");
    expect(prisma.household.findFirst.mock.calls[0][0].include.members.where).toEqual({ deletedAt: null });
  });

  it("throws NotFound outside the actor's scope", async () => {
    prisma.household.findFirst.mockResolvedValue(null);
    await expect(service.get(branchStaff, "h1")).rejects.toThrow(NotFoundException);
  });

  it("forbids creating a household in another branch", async () => {
    await expect(service.create(branchStaff, { name: "Lim Family", branchId: BRANCH_B })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("creates and audits a household", async () => {
    prisma.household.create.mockResolvedValue({ id: "h1" });
    await service.create(superAdmin, { name: "Lim Family", branchId: BRANCH_A });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "households.create", entityId: "h1" }));
  });

  it("refuses to move a household with members to another branch", async () => {
    prisma.household.findFirst.mockResolvedValue({ id: "h1", branchId: BRANCH_A });
    prisma.member.count.mockResolvedValue(2);
    await expect(service.update(superAdmin, "h1", { branchId: BRANCH_B })).rejects.toThrow(BadRequestException);
  });

  it("refuses to archive a household that still has members", async () => {
    prisma.household.findFirst.mockResolvedValue({ id: "h1", branchId: BRANCH_A });
    prisma.member.count.mockResolvedValue(1);
    await expect(service.archive(superAdmin, "h1")).rejects.toThrow(BadRequestException);
  });

  it("archives an empty household", async () => {
    prisma.household.findFirst.mockResolvedValue({ id: "h1", branchId: BRANCH_A });
    prisma.member.count.mockResolvedValue(0);
    prisma.household.update.mockResolvedValue({});
    await service.archive(superAdmin, "h1");
    expect(prisma.household.update).toHaveBeenCalledWith({ where: { id: "h1" }, data: { deletedAt: expect.any(Date) } });
  });
});
