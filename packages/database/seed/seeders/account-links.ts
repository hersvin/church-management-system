import { SAMPLE_ACCOUNT_LINKS } from "../data";
import type { SeedContext, SeedResult } from "../context";

/** Links sample accounts to member records. Leaves accounts that already have a link alone. */
export async function seedAccountLinks({ prisma }: SeedContext): Promise<SeedResult> {
  let linked = 0;
  for (const link of SAMPLE_ACCOUNT_LINKS) {
    const [user, member] = await Promise.all([
      prisma.user.findUnique({ where: { email: link.userEmail }, select: { id: true, memberId: true } }),
      prisma.member.findFirst({ where: { email: link.memberEmail, deletedAt: null }, select: { id: true, user: { select: { id: true } } } }),
    ]);
    if (!user || !member || user.memberId || member.user) continue;
    await prisma.user.update({ where: { id: user.id }, data: { memberId: member.id } });
    linked += 1;
  }
  return { name: "accounts", summary: `${linked} accounts linked to members` };
}
