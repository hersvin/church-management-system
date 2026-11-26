import { splitName, type SeedContext, type SeedResult } from "../context";
import { RETIRED_MINISTRIES, SAMPLE_MINISTRIES } from "../data";

/** Ministries, their volunteer roles, and rosters. Skips anyone already on an active roster. */
export async function seedMinistries(ctx: SeedContext): Promise<SeedResult> {
  const { prisma } = ctx;
  let rosterAdded = 0;

  for (const { roles, roster, branchCode, ...ministry } of SAMPLE_MINISTRIES) {
    const branchId = ctx.branchIds.get(branchCode)!;
    const row =
      (await prisma.ministry.findFirst({ where: { name: ministry.name, branchId, deletedAt: null } })) ??
      (await prisma.ministry.create({ data: { ...ministry, branchId } }));

    const roleIds = new Map<string, string>();
    for (const name of roles) {
      const role = await prisma.ministryRole.upsert({
        where: { ministryId_name: { ministryId: row.id, name } },
        update: {},
        create: { ministryId: row.id, name },
      });
      roleIds.set(name, role.id);
    }

    for (const entry of roster) {
      const person = await prisma.member.findFirst({ where: { ...splitName(entry.person), branchId, deletedAt: null } });
      if (!person) continue;
      const active = await prisma.ministryMember.findFirst({ where: { ministryId: row.id, memberId: person.id, leftAt: null } });
      if (active) continue;
      await prisma.ministryMember.create({
        data: {
          ministryId: row.id,
          memberId: person.id,
          position: entry.position,
          ministryRoleId: entry.role ? roleIds.get(entry.role) : undefined,
        },
      });
      rosterAdded += 1;
    }
  }

  const retired = await retireOldMinistries(ctx);
  return {
    name: "ministries",
    summary: `${SAMPLE_MINISTRIES.length} ministries, ${rosterAdded} new roster entries, ${retired} old ministries retired`,
  };
}

/**
 * Databases seeded before the four ministries still hold the earlier sample ones. Their events move to the
 * matching new ministry (or to none), their rosters end today, and the ministry is soft-deleted. Nothing is hard-deleted.
 */
async function retireOldMinistries(ctx: SeedContext): Promise<number> {
  const { prisma } = ctx;
  const now = new Date();
  let retired = 0;
  for (const old of RETIRED_MINISTRIES) {
    const rows = await prisma.ministry.findMany({ where: { name: old.name, deletedAt: null }, select: { id: true } });
    if (rows.length === 0) continue;
    const target = old.eventsMoveTo
      ? await prisma.ministry.findFirst({ where: { name: old.eventsMoveTo, deletedAt: null }, select: { id: true } })
      : null;
    const ids = rows.map((r) => r.id);
    await prisma.$transaction([
      prisma.event.updateMany({ where: { ministryId: { in: ids } }, data: { ministryId: target?.id ?? null } }),
      prisma.ministryMember.updateMany({ where: { ministryId: { in: ids }, leftAt: null }, data: { leftAt: now } }),
      prisma.ministry.updateMany({ where: { id: { in: ids } }, data: { deletedAt: now, isActive: false } }),
    ]);
    retired += rows.length;
  }
  return retired;
}
