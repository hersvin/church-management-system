import { ConflictException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPrismaMock, type PrismaMock } from "../test/prisma-mock";
import { BranchesService } from "./branches.service";

describe("BranchesService", () => {
  let prisma: PrismaMock;
  let audit: { record: ReturnType<typeof vi.fn> };
  let service: BranchesService;

  beforeEach(() => {
    prisma = createPrismaMock();
    audit = { record: vi.fn() };
    service = new BranchesService(prisma as never, audit as never);
  });

  it("lists branches ordered by name", async () => {
    prisma.branch.findMany.mockResolvedValue([]);
    await service.list();
    expect(prisma.branch.findMany).toHaveBeenCalledWith({ orderBy: { name: "asc" } });
  });

  it("creates a branch and audits it", async () => {
    prisma.branch.findUnique.mockResolvedValue(null);
    prisma.branch.create.mockResolvedValue({ id: "b1", name: "Main", code: "MAIN" });
    await service.create("actor", { name: "Main", code: "MAIN" });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "branches.create", entityId: "b1", actorId: "actor" }),
    );
  });

  it("rejects a duplicate code", async () => {
    prisma.branch.findUnique.mockResolvedValue({ id: "b0" });
    await expect(service.create("actor", { name: "Main", code: "MAIN" })).rejects.toThrow(ConflictException);
  });

  it("throws NotFound when updating a missing branch", async () => {
    prisma.branch.findUnique.mockResolvedValue(null);
    await expect(service.update("actor", "missing", { name: "X" })).rejects.toThrow(NotFoundException);
  });
});
