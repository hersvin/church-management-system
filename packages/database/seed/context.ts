import type { PrismaClient } from "../src/generated/prisma/client";

/** Shared state passed from one seeder to the next. */
export interface SeedContext {
  prisma: PrismaClient;
  adminId: string;
  /** Branch id by branch code, for example MAIN. */
  branchIds: Map<string, string>;
  /** Role id by role key, for example ADMIN. */
  roleIds: Map<string, string>;
  /** Room id by `${branchCode}:${roomName}`. */
  roomIds: Map<string, string>;
  /** Anchor for relative dates: 00:00 Manila time on the next Sunday. */
  sunday: Date;
  now: Date;
}

export interface SeedResult {
  name: string;
  summary: string;
}

/** Splits "First Last" into the fields used to look a sample person up. */
export function splitName(person: string): { firstName: string; lastName: string } {
  const [firstName, ...rest] = person.split(" ");
  return { firstName, lastName: rest.join(" ") };
}

/** A calendar date string (YYYY-MM-DD) as UTC midnight, matching Postgres DATE columns. */
export const toDate = (value?: string) => (value ? new Date(`${value}T00:00:00Z`) : undefined);
