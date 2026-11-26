import { describe, expect, it } from "vitest";
import { createPrismaMock } from "../test/prisma-mock";
import { AuditService, redact } from "./audit.service";

describe("redact", () => {
  it("masks sensitive keys at any depth", () => {
    expect(
      redact({ email: "a@b.org", password: "x", nested: { passwordHash: "h", token: "t" } }),
    ).toEqual({
      email: "a@b.org",
      password: "[REDACTED]",
      nested: { passwordHash: "[REDACTED]", token: "[REDACTED]" },
    });
  });

  it("masks kids check-in pickup codes but keeps branch codes", () => {
    expect(redact({ pickupCode: "K7RQX", code: "MAIN" })).toEqual({ pickupCode: "[REDACTED]", code: "MAIN" });
  });
});

describe("AuditService", () => {
  it("stores a redacted entry", async () => {
    const prisma = createPrismaMock();
    prisma.auditLog.create.mockResolvedValue({});
    await new AuditService(prisma as never).record({
      actorId: "u1",
      action: "users.create",
      entity: "User",
      entityId: "u2",
      changes: { email: "a@b.org", password: "secret" },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "users.create",
        changes: { email: "a@b.org", password: "[REDACTED]" },
      }),
    });
  });

  it("lists newest first with pagination", async () => {
    const prisma = createPrismaMock();
    prisma.auditLog.findMany.mockResolvedValue([]);
    prisma.auditLog.count.mockResolvedValue(0);
    const result = await new AuditService(prisma as never).list({ page: 2, pageSize: 10 });
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10, orderBy: { createdAt: "desc" } }),
    );
    expect(result).toEqual({ items: [], total: 0, page: 2, pageSize: 10 });
  });
});
