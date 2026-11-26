import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { apiReference } from "@scalar/nestjs-api-reference";
import type { Request, Response } from "express";
import { SESSION_COOKIE } from "../auth/session-user";
import type { Env } from "../config/env";

export const DOCS_PATH = "/docs";
export const OPENAPI_PATH = "/openapi.json";

/**
 * Builds the OpenAPI document from the live controllers on every boot, so the
 * Scalar reference always matches the running API.
 */
export function setupApiDocs(app: INestApplication, env: Env): void {
  if (!env.API_DOCS_ENABLED) return;

  const config = new DocumentBuilder()
    .setTitle("Church Management System API")
    .setDescription(
      "REST API for the church management system. Sign in with POST /auth/login: the session cookie is then sent automatically from this page.",
    )
    .setVersion("0.2.0")
    .addCookieAuth(SESSION_COOKIE, { type: "apiKey", in: "cookie", name: SESSION_COOKIE }, "cookie")
    .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" }, "bearer")
    .build();

  const document = SwaggerModule.createDocument(app, config);

  const http = app.getHttpAdapter();
  http.get(OPENAPI_PATH, (_req: Request, res: Response) => {
    res.json(document);
  });
  http.get("/", (_req: Request, res: Response) => {
    res.redirect(302, DOCS_PATH);
  });

  app.use(
    DOCS_PATH,
    apiReference({
      url: OPENAPI_PATH,
      pageTitle: "Church Management System API",
      theme: "default",
      withDefaultFonts: false,
      credentials: "include",
      // Hide Scalar's localhost toolbar and hosting promotions.
      showDeveloperTools: "never",
    } as Parameters<typeof apiReference>[0]),
  );
}
