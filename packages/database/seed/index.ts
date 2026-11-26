/**
 * Seeds every module of the church management system. Safe to run repeatedly:
 * each seeder matches existing rows and only adds what is missing.
 *
 * Run from the backend:  pnpm --filter @cms/api db:seed
 * or from this package:  pnpm --filter @cms/database seed
 */
import path from "node:path";
import { passwordSchema } from "@cms/shared";
import { z } from "zod";
import { createPrismaClient } from "../src";
import { loadDatabaseEnv } from "../src/env";
import type { SeedContext, SeedResult } from "./context";
import { nextSundayManila } from "./data";
import { seedAccountLinks } from "./seeders/account-links";
import { seedAttendance } from "./seeders/attendance";
import { seedCore } from "./seeders/core";
import { seedMembers } from "./seeders/members";
import { seedMinistries } from "./seeders/ministries";
import { seedEvents, seedRooms } from "./seeders/rooms-events";
import { seedSchool } from "./seeders/school";

// Compiled to dist/seed/index.js, so the package root is two levels up.
loadDatabaseEnv(path.resolve(__dirname, "..", ".."));

const env = z
  .object({
    DATABASE_URL: z.string().min(1),
    SEED_ADMIN_EMAIL: z.string().trim().toLowerCase().pipe(z.email()),
    SEED_ADMIN_PASSWORD: passwordSchema,
    SEED_SAMPLE_PASSWORD: passwordSchema.optional(),
  })
  .parse(process.env);

/** Seeders after core, in dependency order. */
const SEEDERS: ((ctx: SeedContext) => Promise<SeedResult>)[] = [seedMembers, seedAccountLinks, seedMinistries, seedRooms, seedEvents, seedSchool, seedAttendance];

async function main() {
  const prisma = createPrismaClient(env.DATABASE_URL);
  try {
    const core = await seedCore(prisma, {
      adminEmail: env.SEED_ADMIN_EMAIL,
      adminPassword: env.SEED_ADMIN_PASSWORD,
      samplePassword: env.SEED_SAMPLE_PASSWORD,
    });
    console.log(`  ${core.name.padEnd(11)} ${core.summary}`);

    const now = new Date();
    const ctx: SeedContext = {
      prisma,
      adminId: core.adminId,
      branchIds: core.branchIds,
      roleIds: core.roleIds,
      roomIds: new Map(),
      sunday: nextSundayManila(now),
      now,
    };
    for (const seeder of SEEDERS) {
      const result = await seeder(ctx);
      console.log(`  ${result.name.padEnd(11)} ${result.summary}`);
    }

    if ((await prisma.auditLog.count({ where: { action: "system.seed" } })) === 0) {
      await prisma.auditLog.create({ data: { actorId: core.adminId, action: "system.seed", entity: "System" } });
    }
    console.log("Seed complete.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Seed failed:", error instanceof Error ? error.message : "unknown error");
  process.exit(1);
});
