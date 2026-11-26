import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../app.module";
import { ENV, parseEnv } from "../config/env";
import { PrismaService } from "../prisma/prisma.service";
import { createPrismaMock } from "../test/prisma-mock";
import { setupApiDocs } from "./api-docs";

interface OpenApiDoc {
  info: { title: string };
  paths: Record<string, Record<string, { requestBody?: { content: Record<string, { schema: unknown }> }; parameters?: { name: string; in: string }[]; security?: unknown[] }>>;
  components: { securitySchemes: Record<string, unknown> };
}

describe("API docs", () => {
  let app: INestApplication;
  let doc: OpenApiDoc;

  beforeAll(async () => {
    const env = parseEnv({
      DATABASE_URL: "postgresql://u:p@localhost:5432/cms",
      JWT_SECRET: "t".repeat(32),
      WEB_ORIGIN: "http://localhost:3000",
      NODE_ENV: "test",
    });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ENV)
      .useValue(env)
      .overrideProvider(PrismaService)
      .useValue(createPrismaMock())
      .compile();
    app = moduleRef.createNestApplication();
    setupApiDocs(app, env);
    await app.init();
    doc = (await request(app.getHttpServer()).get("/openapi.json")).body as OpenApiDoc;
  });

  afterAll(async () => {
    await app.close();
  });

  it("serves the OpenAPI document publicly", () => {
    expect(doc.info.title).toBe("Church Management System API");
  });

  it("documents every controller route", () => {
    for (const path of ["/auth/login", "/users", "/users/{id}", "/branches", "/settings", "/audit", "/members", "/members/{id}", "/households", "/ministries", "/ministries/stats", "/ministries/{id}", "/ministries/{id}/roles", "/ministries/{id}/roles/{roleId}", "/ministries/{id}/members", "/ministries/{id}/members/{memberId}", "/members/{id}/ministries", "/rooms", "/rooms/{id}", "/bookings", "/bookings/pending", "/bookings/{id}/approve", "/bookings/{id}/reject", "/bookings/{id}/cancel", "/events", "/events/upcoming", "/events/{id}", "/events/{id}/cancel", "/events/{id}/registrations", "/events/{id}/registrations/{registrationId}", "/school/terms", "/school/terms/{id}", "/school/classes", "/school/classes/{id}", "/school/classes/{id}/teachers", "/school/classes/{id}/teachers/{memberId}", "/school/classes/{id}/enrollments", "/school/enrollments/{id}", "/school/classes/{id}/sessions", "/school/sessions/{id}", "/school/sessions/{id}/attendance", "/school/stats", "/members/{id}/school", "/services", "/services/{id}", "/services/{id}/check-ins", "/events/{id}/check-ins", "/check-ins/{id}", "/check-ins/{id}/guardians", "/check-ins/{id}/checkout", "/attendance/stats", "/members/{id}/attendance", "/reports/{kind}", "/reports/{kind}/csv", "/public/landing", "/public/videos", "/auth/token", "/me/member", "/me/account", "/me/photo", "/me/qr", "/me/check-ins", "/me/attendance", "/me/services", "/me/services/{id}", "/me/ministries", "/me/ministry-requests", "/me/events", "/me/events/{id}", "/me/event-registrations", "/services/{id}/qr", "/services/{id}/check-ins/scan", "/ministries/{id}/join-requests", "/ministry-requests/{id}/decision", "/music/search", "/music/songs", "/music/songs/{id}", "/music/playlists", "/music/playlists/{id}", "/music/playlists/{id}/songs", "/music/playlists/{id}/duplicate"]) {
      expect(doc.paths).toHaveProperty([path]);
    }
  });

  it("derives request bodies from the shared Zod schemas", () => {
    const body = doc.paths["/auth/login"].post.requestBody?.content["application/json"].schema as {
      properties: Record<string, unknown>;
      required: string[];
    };
    expect(Object.keys(body.properties)).toEqual(expect.arrayContaining(["email", "password"]));
    expect(body.required).toEqual(expect.arrayContaining(["email", "password"]));
  });

  it("derives query parameters from Zod schemas", () => {
    const names = (doc.paths["/members"].get.parameters ?? []).map((p) => p.name);
    expect(names).toEqual(expect.arrayContaining(["page", "pageSize", "search", "status"]));
  });

  it("documents the ministry roster body from the shared schema", () => {
    const body = doc.paths["/ministries/{id}/members"].post.requestBody?.content["application/json"].schema as {
      properties: Record<string, unknown>;
    };
    expect(Object.keys(body.properties)).toEqual(expect.arrayContaining(["memberId", "position", "ministryRoleId"]));
  });

  it("documents event creation with the repeat rule", () => {
    const body = doc.paths["/events"].post.requestBody?.content["application/json"].schema as {
      properties: Record<string, unknown>;
    };
    expect(Object.keys(body.properties)).toEqual(expect.arrayContaining(["title", "startsAt", "endsAt", "roomId", "repeat"]));
  });

  it("declares cookie and bearer auth", () => {
    expect(Object.keys(doc.components.securitySchemes)).toEqual(expect.arrayContaining(["cookie", "bearer"]));
  });

  it("serves the Scalar reference UI", async () => {
    const res = await request(app.getHttpServer()).get("/docs");
    expect(res.status).toBe(200);
    expect(res.text.toLowerCase()).toContain("scalar");
  });

  it("hides Scalar's developer toolbar and promotions", async () => {
    const res = await request(app.getHttpServer()).get("/docs");
    expect(res.text).toContain("showDeveloperTools");
    expect(res.text).toContain("never");
  });

  it("redirects the API root to the docs", async () => {
    const res = await request(app.getHttpServer()).get("/");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/docs");
  });
});

describe("parseEnv API_DOCS_ENABLED", () => {
  const base = {
    DATABASE_URL: "postgresql://u:p@localhost:5432/cms",
    JWT_SECRET: "a".repeat(32),
    WEB_ORIGIN: "http://localhost:3000",
  };

  it("defaults to enabled outside production", () => {
    expect(parseEnv(base).API_DOCS_ENABLED).toBe(true);
  });

  it("defaults to disabled in production", () => {
    expect(parseEnv({ ...base, NODE_ENV: "production" }).API_DOCS_ENABLED).toBe(false);
  });

  it("can be enabled explicitly in production", () => {
    expect(parseEnv({ ...base, NODE_ENV: "production", API_DOCS_ENABLED: "true" }).API_DOCS_ENABLED).toBe(true);
  });
});
