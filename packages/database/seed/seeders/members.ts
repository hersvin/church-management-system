import { toDate, type SeedContext, type SeedResult } from "../context";
import { SAMPLE_HOUSEHOLDS, SAMPLE_INDIVIDUALS, type SampleMember } from "../data";

/** Households and members, matched by name within a branch so reruns add nothing. */
export async function seedMembers(ctx: SeedContext): Promise<SeedResult> {
  const { prisma } = ctx;

  const createIfMissing = async (member: SampleMember, branchId: string, householdId: string | null) => {
    const existing = await prisma.member.findFirst({
      where: { firstName: member.firstName, lastName: member.lastName, branchId, deletedAt: null },
    });
    if (existing) return false;
    await prisma.member.create({
      data: {
        ...member,
        birthDate: toDate(member.birthDate),
        membershipDate: toDate(member.membershipDate),
        baptismDate: toDate(member.baptismDate),
        branchId,
        householdId,
        statusHistory: { create: { fromStatus: null, toStatus: member.status, changedById: ctx.adminId } },
      },
    });
    return true;
  };

  let created = 0;
  for (const { members, branchCode, ...household } of SAMPLE_HOUSEHOLDS) {
    const branchId = ctx.branchIds.get(branchCode)!;
    const row =
      (await prisma.household.findFirst({ where: { name: household.name, branchId, deletedAt: null } })) ??
      (await prisma.household.create({ data: { ...household, branchId } }));
    for (const member of members) if (await createIfMissing(member, branchId, row.id)) created += 1;
  }
  for (const { branchCode, ...member } of SAMPLE_INDIVIDUALS) {
    if (await createIfMissing(member, ctx.branchIds.get(branchCode)!, null)) created += 1;
  }

  return { name: "members", summary: `${SAMPLE_HOUSEHOLDS.length} households, ${created} new members` };
}
