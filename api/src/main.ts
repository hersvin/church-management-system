import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import type { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { ENV, type Env } from "./config/env";
import { DOCS_PATH, setupApiDocs } from "./docs/api-docs";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Room for a profile photo sent as base64 (the app keeps them near 100 KB; the schema caps them).
  app.useBodyParser("json", { limit: "1mb" });
  const env = app.get<Env>(ENV);

  const strictHelmet = helmet();
  // The Scalar reference page loads its script from a CDN, so it gets a relaxed CSP. Everything else stays strict.
  const docsHelmet = helmet({
    contentSecurityPolicy: {
      directives: {
        "script-src": ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        "style-src": ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
        "font-src": ["'self'", "data:", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net"],
        "img-src": ["'self'", "data:", "https:"],
        "connect-src": ["'self'", "https://cdn.jsdelivr.net"],
        "worker-src": ["'self'", "blob:"],
      },
    },
  });
  app.use((req: Request, res: Response, next: NextFunction) =>
    (req.path.startsWith(DOCS_PATH) ? docsHelmet : strictHelmet)(req, res, next),
  );
  app.use(cookieParser());
  app.enableCors({ origin: env.CORS_ORIGINS, credentials: true });
  app.enableShutdownHooks();
  setupApiDocs(app, env);

  await app.listen(env.PORT);
  console.log(`API listening on http://localhost:${env.PORT}`);
  if (env.API_DOCS_ENABLED) console.log(`API reference at http://localhost:${env.PORT}${DOCS_PATH}`);
}

void bootstrap();
