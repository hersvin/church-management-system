import { ROLE_DEFAULT_PERMISSIONS, ROLE_KEYS } from "@cms/shared";
import bcrypt from "bcryptjs";
import type { Prisma, PrismaClient } from "../../src/generated/prisma/client";
import type { SeedResult } from "../context";
import { ROLE_NAMES, SAMPLE_BRANCHES, SAMPLE_SETTINGS, SAMPLE_USERS } from "../data";

export interface CoreSeedInput {
  adminEmail: string;
  adminPassword: string;
  samplePassword?: string;
}

export interface CoreSeedOutput extends SeedResult {
  adminId: string;
  roleIds: Map<string, string>;
  branchIds: Map<string, string>;
}

/** Roles with their default permissions, branches, the super admin, sample staff accounts, and settings. */
export async function seedCore(prisma: PrismaClient, input: CoreSeedInput): Promise<CoreSeedOutput> {
  const roleIds = new Map<string, string>();
  for (const key of ROLE_KEYS) {
    const permissions = [...ROLE_DEFAULT_PERMISSIONS[key]];
    // Permissions are refreshed on every run so new permissions reach existing databases.
    const role = await prisma.role.upsert({
      where: { key },
      update: { permissions },
      create: { key, name: ROLE_NAMES[key], permissions, isSystem: true },
    });
    roleIds.set(key, role.id);
  }

  const branchIds = new Map<string, string>();
  for (const branch of SAMPLE_BRANCHES) {
    const row = await prisma.branch.upsert({ where: { code: branch.code }, update: {}, create: { ...branch } });
    branchIds.set(branch.code, row.id);
  }

  const admin = await prisma.user.upsert({
    where: { email: input.adminEmail },
    update: {},
    create: {
      email: input.adminEmail,
      passwordHash: await bcrypt.hash(input.adminPassword, 12),
      firstName: "System",
      lastName: "Administrator",
      roleId: roleIds.get("ADMIN")!,
    },
  });

  let sampleUsers = 0;
  if (input.samplePassword) {
    const hash = await bcrypt.hash(input.samplePassword, 12);
    for (const user of SAMPLE_USERS) {
      await prisma.user.upsert({
        where: { email: user.email },
        update: {},
        create: {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isActive: user.isActive,
          passwordHash: hash,
          roleId: roleIds.get(user.roleKey)!,
          branchId: user.branchCode ? branchIds.get(user.branchCode)! : null,
        },
      });
      sampleUsers += 1;
    }
  }

  for (const setting of SAMPLE_SETTINGS) {
    const branchId = setting.branchCode ? branchIds.get(setting.branchCode)! : null;
    const existing = await prisma.setting.findFirst({ where: { key: setting.key, branchId } });
    if (!existing) {
      await prisma.setting.create({ data: { key: setting.key, value: setting.value as Prisma.InputJsonValue, branchId } });
    }
  }

  return {
    name: "core",
    summary: `${ROLE_KEYS.length} roles, ${SAMPLE_BRANCHES.length} branches, 1 admin, ${sampleUsers} sample users, ${SAMPLE_SETTINGS.length} settings`,
    adminId: admin.id,
    roleIds,
    branchIds,
  };
}
