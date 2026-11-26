import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPrismaMock, type PrismaMock } from "../test/prisma-mock";
import { SettingsService } from "./settings.service";

const BRANCH = "11111111-1111-4111-8111-111111111111";

describe("SettingsService", () => {
  let prisma: PrismaMock;
  let audit: { record: ReturnType<typeof vi.fn> };
  let service: SettingsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    audit = { record: vi.fn() };
    service = new SettingsService(prisma as never, audit as never);
  });

  it("returns global settings when no branch is given", async () => {
    prisma.setting.findMany.mockResolvedValue([{ key: "church.name", value: "Grace", branchId: null }]);
    expect(await service.effective(null)).toEqual({ "church.name": "Grace" });
    expect(prisma.setting.findMany).toHaveBeenCalledWith({ where: { branchId: null } });
  });

  it("lets branch values override global values", async () => {
    prisma.setting.findMany.mockResolvedValue([
      { key: "service.time", value: "09:00", branchId: null },
      { key: "service.time", value: "10:30", branchId: BRANCH },
      { key: "church.name", value: "Grace", branchId: null },
    ]);
    expect(await service.effective(BRANCH)).toEqual({ "service.time": "10:30", "church.name": "Grace" });
  });

  it("updates an existing setting and audits the change", async () => {
    prisma.setting.findFirst.mockResolvedValue({ id: "s1", key: "church.name", value: "Old" });
    prisma.setting.update.mockResolvedValue({ id: "s1", key: "church.name", value: "New" });
    await service.upsert("actor", { key: "church.name", value: "New" });
    expect(prisma.setting.update).toHaveBeenCalledWith({ where: { id: "s1" }, data: { value: "New" } });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "settings.upsert", changes: { key: "church.name", from: "Old", to: "New" } }),
    );
  });

  it("creates a missing setting", async () => {
    prisma.setting.findFirst.mockResolvedValue(null);
    prisma.setting.create.mockResolvedValue({ id: "s2" });
    await service.upsert("actor", { key: "church.name", value: "New", branchId: BRANCH });
    expect(prisma.setting.create).toHaveBeenCalledWith({
      data: { key: "church.name", value: "New", branchId: BRANCH },
    });
  });
});
