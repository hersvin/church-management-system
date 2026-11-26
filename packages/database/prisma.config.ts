import { defineConfig } from "prisma/config";
import { loadDatabaseEnv } from "./src/env";

// Prisma commands run from this package's folder (pnpm --filter @cms/database ...).
loadDatabaseEnv(process.cwd());

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Used by `prisma migrate reset` (the migrate:reset script builds first).
    seed: "node dist/seed/index.js",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
