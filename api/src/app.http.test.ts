import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "./app.module";
import { ENV, parseEnv } from "./config/env";
import { PrismaService } from "./prisma/prisma.service";
import { createPrismaMock, type PrismaMock } from "./test/prisma-mock";

const env = parseEnv({
  DATABASE_URL: "postgresql://u:p@localhost:5432/cms",
  JWT_SECRET: "t".repeat(32),
  WEB_ORIGIN: "http://localhost:3000",
  NODE_ENV: "test",
});

describe("HTTP API", () => {
  let app: INestApplication;
  let prisma: PrismaMock;
  let hash: string;

  const user = (permissions: string[]) => ({
    id: "11111111-1111-4111-8111-111111111111",
    email: "admin@church.org",
    passwordHash: hash,
    firstName: "Ana",
    lastName: "Cruz",
    isActive: true,
    tokenVersion: 0,
    branchId: null,
    role: { key: "ADMIN", permissions },
  });

  beforeAll(async () => {
    hash = await bcrypt.hash("correct-password", 4);
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ENV)
      .useValue(env)
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    prisma.user.update.mockResolvedValue({});
    prisma.auditLog.create.mockResolvedValue({});
  });

  async function loginAs(permissions: string[]) {
    prisma.user.findUnique.mockResolvedValue(user(permissions));
    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "admin@church.org", password: "correct-password" });
    expect(res.status).toBe(200);
    return res.headers["set-cookie"] as unknown as string[];
  }

  it("serves the health check without a session", async () => {
    const res = await request(app.getHttpServer()).get("/health");
    expect(res.status).toBe(200);
  });

  it("serves public landing data without a session, cacheable", async () => {
    prisma.setting.findMany.mockResolvedValue([]);
    prisma.branch.findMany.mockResolvedValue([]);
    prisma.ministry.findMany.mockResolvedValue([]);
    prisma.room.findMany.mockResolvedValue([]);
    const res = await request(app.getHttpServer()).get("/public/landing");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("public, max-age=300");
    expect(res.body).toEqual({
      church: { name: null, tagline: null, email: null, phone: null },
      campuses: [],
      ministries: [],
      rooms: [],
    });
  });

  it("rejects protected routes without a session", async () => {
    const res = await request(app.getHttpServer()).get("/users");
    expect(res.status).toBe(401);
  });

  it("validates the login body", async () => {
    const res = await request(app.getHttpServer()).post("/auth/login").send({ email: "bad" });
    expect(res.status).toBe(400);
  });

  it("sets an httpOnly session cookie on login and returns the user", async () => {
    const cookies = await loginAs(["users.read"]);
    expect(cookies.join(";")).toMatch(/cms_session=.+HttpOnly/i);
    expect(cookies.join(";")).toMatch(/SameSite=Lax/i);
  });

  it("returns the session user from /auth/me", async () => {
    const cookies = await loginAs(["users.read"]);
    const res = await request(app.getHttpServer()).get("/auth/me").set("Cookie", cookies);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ email: "admin@church.org", permissions: ["users.read"] });
    expect(res.body).not.toHaveProperty("passwordHash");
  });

  it("returns 403 when the permission is missing", async () => {
    const cookies = await loginAs(["users.read"]);
    const res = await request(app.getHttpServer())
      .post("/branches")
      .set("Cookie", cookies)
      .send({ name: "North", code: "NORTH" });
    expect(res.status).toBe(403);
  });

  it("lists users when permitted", async () => {
    const cookies = await loginAs(["users.read"]);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.count.mockResolvedValue(0);
    const res = await request(app.getHttpServer()).get("/users?page=1").set("Cookie", cookies);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
  });

  describe("me (mobile app)", () => {
    it("issues a bearer token for native apps that works without a cookie", async () => {
      prisma.user.findUnique.mockResolvedValue(user(["events.read"]));
      const res = await request(app.getHttpServer())
        .post("/auth/token")
        .send({ email: "admin@church.org", password: "correct-password" });
      expect(res.status).toBe(200);
      expect(res.headers["set-cookie"]).toBeUndefined();
      expect(res.body.user).toMatchObject({ email: "admin@church.org" });
      expect(res.body.user).not.toHaveProperty("passwordHash");
      const me = await request(app.getHttpServer()).get("/auth/me").set("Authorization", `Bearer ${res.body.accessToken}`);
      expect(me.status).toBe(200);
    });

    it("needs a session", async () => {
      expect((await request(app.getHttpServer()).get("/me/qr")).status).toBe(401);
    });

    it("explains when the account has no member record", async () => {
      prisma.user.findUnique.mockResolvedValue({ ...user([]), memberId: null, member: null });
      const token = await app.get(JwtService).signAsync({ sub: user([]).id, ver: 0 });
      const res = await request(app.getHttpServer()).get("/me/qr").set("Cookie", [`cms_session=${token}`]);
      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/not linked to a member/);
    });
  });

  describe("reports", () => {
    // Login is throttled to 5 a minute, so these tests sign a session token directly.
    const sessionWith = async (permissions: string[]) => {
      prisma.user.findUnique.mockResolvedValue(user(permissions));
      const token = await app.get(JwtService).signAsync({ sub: user(permissions).id, ver: 0 });
      return [`cms_session=${token}`];
    };

    it("returns 403 without reports.read", async () => {
      const cookies = await sessionWith(["members.read"]);
      const res = await request(app.getHttpServer()).get("/reports/rooms").set("Cookie", cookies);
      expect(res.status).toBe(403);
    });

    it("returns 400 for an unknown report kind or a reversed range", async () => {
      const cookies = await sessionWith(["reports.read"]);
      expect((await request(app.getHttpServer()).get("/reports/giving").set("Cookie", cookies)).status).toBe(400);
      const reversed = await request(app.getHttpServer())
        .get("/reports/rooms?from=2026-11-25&to=2026-11-01")
        .set("Cookie", cookies);
      expect(reversed.status).toBe(400);
    });

    it("returns a report as JSON", async () => {
      const cookies = await sessionWith(["reports.read"]);
      prisma.room.findMany.mockResolvedValue([]);
      const res = await request(app.getHttpServer())
        .get("/reports/rooms?from=2026-11-01&to=2026-11-30")
        .set("Cookie", cookies);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ kind: "rooms", from: "2026-11-01", to: "2026-11-30", branchId: null, rows: [] });
    });

    it("downloads a report as CSV", async () => {
      const cookies = await sessionWith(["reports.read"]);
      prisma.room.findMany.mockResolvedValue([]);
      const res = await request(app.getHttpServer())
        .get("/reports/rooms/csv?from=2026-11-01&to=2026-11-30")
        .set("Cookie", cookies);
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/^text\/csv; charset=utf-8/);
      expect(res.headers["content-disposition"]).toBe('attachment; filename="rooms-2026-11-01-to-2026-11-30.csv"');
      expect(res.text).toContain("Room,Branch,Capacity");
    });
  });
});
