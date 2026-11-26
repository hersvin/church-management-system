import { generatePickupCode, isLikelyChild } from "@cms/shared";
import type { SeedContext, SeedResult } from "../context";
import { PAST_SERVICE_WEEKS, SAMPLE_SERVICES, attendsService, manilaTime, pastServiceSundays, sampleHeadcount } from "../data";

const MINUTE_MS = 60 * 1000;

/**
 * Weekly services for the past weeks plus the next Sunday, with headcounts and member check-ins.
 * Children are checked in with their household head as guardian and checked out after the service.
 * Dates are relative to the next Sunday, so this only runs when no sample service exists yet.
 */
export async function seedAttendance(ctx: SeedContext): Promise<SeedResult> {
  const { prisma } = ctx;
  const first = SAMPLE_SERVICES[0];
  const existing = await prisma.service.count({
    where: { name: first.name, branchId: ctx.branchIds.get(first.branchCode)!, deletedAt: null },
  });
  if (existing > 0) return { name: "attendance", summary: "already seeded, skipped" };

  // Codes of past, checked-out children only need to look real; a counter keeps reruns stable.
  let codeSeed = 0;
  const nextCode = () => generatePickupCode((max) => (codeSeed++ * 7 + 3) % max);

  const sundays = pastServiceSundays(ctx.sunday, PAST_SERVICE_WEEKS);
  let services = 0;
  let checkIns = 0;
  for (const template of SAMPLE_SERVICES) {
    const branchId = ctx.branchIds.get(template.branchCode)!;
    const people = template.checkIns
      ? await prisma.member.findMany({
          where: { branchId, deletedAt: null, status: { not: "INACTIVE" } },
          include: { household: { include: { members: { where: { householdRole: "HEAD", deletedAt: null } } } } },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        })
      : [];

    // The upcoming service has no attendance yet.
    await prisma.service.create({
      data: { name: template.name, branchId, startsAt: manilaTime(ctx.sunday, 0, template.time), createdById: ctx.adminId },
    });
    services += 1;

    for (const [weekIndex, day] of sundays.entries()) {
      const startsAt = manilaTime(day, 0, template.time);
      const service = await prisma.service.create({
        data: {
          name: template.name,
          branchId,
          startsAt,
          headcount: sampleHeadcount(template, weekIndex),
          createdById: ctx.adminId,
        },
      });
      services += 1;

      for (const [personIndex, person] of people.entries()) {
        if (!attendsService(personIndex, weekIndex)) continue;
        const checkedInAt = new Date(startsAt.getTime() - 15 * MINUTE_MS + personIndex * MINUTE_MS);
        const head = person.household?.members.find((m) => m.id !== person.id);
        const child = head && isLikelyChild(person, startsAt);
        await prisma.checkIn.create({
          data: child
            ? {
                kind: "CHILD",
                branchId,
                serviceId: service.id,
                memberId: person.id,
                guardianMemberId: head.id,
                pickupCode: nextCode(),
                checkedInAt,
                checkedInById: ctx.adminId,
                checkedOutAt: new Date(startsAt.getTime() + 105 * MINUTE_MS),
                checkedOutById: ctx.adminId,
                pickedUpByMemberId: head.id,
              }
            : { kind: "ATTENDEE", branchId, serviceId: service.id, memberId: person.id, checkedInAt, checkedInById: ctx.adminId },
        });
        checkIns += 1;
      }

      if (template.checkIns && weekIndex % 3 === 0) {
        await prisma.checkIn.create({
          data: { kind: "ATTENDEE", branchId, serviceId: service.id, guestName: "First-time Guest", checkedInAt: startsAt, checkedInById: ctx.adminId },
        });
        checkIns += 1;
      }
    }
  }

  return { name: "attendance", summary: `${services} services, ${checkIns} check-ins` };
}
