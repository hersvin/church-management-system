import { UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPrismaMock, type PrismaMock } from "../test/prisma-mock";
import { AuthService } from "./auth.service";

const SECRET = "s".repeat(32);

describe("AuthService", () => {
  let prisma: PrismaMock;
  let jwt: JwtService;
  let audit: { record: ReturnType<typeof vi.fn> };
  let service: AuthService;
  let passwordHash: string;

  beforeEach(async () => {
    prisma = createPrismaMock();
    jwt = new JwtService({ secret: SECRET, signOptions: { expiresIn: 60 } });
    audit = { record: vi.fn() };
    service = new AuthService(prisma as never, jwt, audit as never);
    passwordHash = await bcrypt.hash("correct-password", 4);
  });

  const dbUser = () => ({
    id: "u1",
    email: "admin@church.org",
    passwordHash,
    firstName: "Ana",
    lastName: "Cruz",
    isActive: true,
    tokenVersion: 2,
    branchId: null,
    role: { key: "ADMIN", permissions: ["users.manage"] },
  });

  it("returns a signed token for valid credentials", async () => {
    prisma.user.findUnique.mockResolvedValue(dbUser());
    prisma.user.update.mockResolvedValue({});
    const result = await service.login(
      { email: "admin@church.org", password: "correct-password" },
      "1.2.3.4",
    );
    expect(jwt.verify(result.accessToken)).toMatchObject({ sub: "u1", ver: 2 });
    expect(result.user).not.toHaveProperty("passwordHash");
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "auth.login", actorId: "u1", ipAddress: "1.2.3.4" }),
    );
  });

  it("rejects a wrong password with a generic message", async () => {
    prisma.user.findUnique.mockResolvedValue(dbUser());
    await expect(service.login({ email: "admin@church.org", password: "wrong" })).rejects.toThrow(
      new UnauthorizedException("Invalid email or password"),
    );
  });

  it("rejects an unknown email with the same generic message", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.login({ email: "x@church.org", password: "whatever" })).rejects.toThrow(
      "Invalid email or password",
    );
  });

  it("rejects an inactive user", async () => {
    prisma.user.findUnique.mockResolvedValue({ ...dbUser(), isActive: false });
    await expect(
      service.login({ email: "admin@church.org", password: "correct-password" }),
    ).rejects.toThrow(UnauthorizedException);
  });

  describe("resolveSession", () => {
    it("returns the current user with permissions", async () => {
      prisma.user.findUnique.mockResolvedValue(dbUser());
      expect(await service.resolveSession({ sub: "u1", ver: 2 })).toEqual({
        id: "u1",
        email: "admin@church.org",
        firstName: "Ana",
        lastName: "Cruz",
        roleKey: "ADMIN",
        branchId: null,
        permissions: ["users.manage"],
      });
    });

    it("rejects a token issued before a version bump", async () => {
      prisma.user.findUnique.mockResolvedValue(dbUser());
      await expect(service.resolveSession({ sub: "u1", ver: 1 })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("rejects a deactivated user", async () => {
      prisma.user.findUnique.mockResolvedValue({ ...dbUser(), isActive: false });
      await expect(service.resolveSession({ sub: "u1", ver: 2 })).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
