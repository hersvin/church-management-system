import { randomUUID } from "node:crypto";
import { splitName, type SeedContext, type SeedResult } from "../context";
import { SAMPLE_BOOKING_REQUEST, SAMPLE_EVENTS, SAMPLE_ROOMS, buildSampleSchedule, manilaTime } from "../data";

/** Rooms (matched by name within a branch). Fills ctx.roomIds for later seeders. */
export async function seedRooms(ctx: SeedContext): Promise<SeedResult> {
  for (const { branchCode, ...room } of SAMPLE_ROOMS) {
    const branchId = ctx.branchIds.get(branchCode)!;
    const existing = await ctx.prisma.room.findFirst({ where: { name: room.name, branchId, deletedAt: null } });
    // Rooms seeded before rates existed get the sample rate; a rate someone already set is kept.
    if (existing && existing.hourlyRate === null) {
      await ctx.prisma.room.update({ where: { id: existing.id }, data: { hourlyRate: room.hourlyRate } });
    }
    const row = existing ?? (await ctx.prisma.room.create({ data: { ...room, branchId } }));
    ctx.roomIds.set(`${branchCode}:${room.name}`, row.id);
  }
  return { name: "rooms", summary: `${SAMPLE_ROOMS.length} rooms` };
}

/**
 * Events with approved room bookings and registrations, plus one pending room request.
 * Dates are relative to the next Sunday, so this only runs on a database with no sample events.
 */
export async function seedEvents(ctx: SeedContext): Promise<SeedResult> {
  const { prisma } = ctx;
  if ((await prisma.event.count({ where: { title: SAMPLE_EVENTS[0].title } })) > 0) {
    return { name: "events", summary: "already seeded, skipped" };
  }

  let created = 0;
  let registrations = 0;
  for (const item of buildSampleSchedule(ctx.sunday)) {
    const branchId = ctx.branchIds.get(item.branchCode)!;
    const roomId = item.room ? ctx.roomIds.get(`${item.branchCode}:${item.room}`) : undefined;
    const ministry = item.ministry
      ? // Ministries serve every branch, so an event at any branch can belong to one.
        await prisma.ministry.findFirst({ where: { name: item.ministry, deletedAt: null } })
      : null;
    const seriesId = item.occurrences.length > 1 ? randomUUID() : undefined;

    for (const occurrence of item.occurrences) {
      const event = await prisma.event.create({
        data: {
          title: item.title,
          description: item.description,
          category: item.category,
          ...occurrence,
          capacity: item.capacity,
          registrationRequired: item.registrationRequired ?? false,
          seriesId,
          createdById: ctx.adminId,
          branchId,
          ministryId: ministry?.id,
          roomId,
          ...(roomId
            ? {
                booking: {
                  create: {
                    roomId,
                    ...occurrence,
                    purpose: item.title,
                    status: "APPROVED",
                    requestedById: ctx.adminId,
                    decidedById: ctx.adminId,
                    decidedAt: ctx.now,
                  },
                },
              }
            : {}),
        },
      });
      created += 1;

      for (const person of item.registrants ?? []) {
        const member = await prisma.member.findFirst({ where: { ...splitName(person), branchId, deletedAt: null } });
        if (member) {
          await prisma.eventRegistration.create({ data: { eventId: event.id, memberId: member.id } });
          registrations += 1;
        }
      }
      for (const guestName of item.guests ?? []) {
        await prisma.eventRegistration.create({ data: { eventId: event.id, guestName } });
        registrations += 1;
      }
    }
  }

  const request = SAMPLE_BOOKING_REQUEST;
  const requester = await prisma.user.findUnique({ where: { email: request.requesterEmail } });
  await prisma.roomBooking.create({
    data: {
      roomId: ctx.roomIds.get(`${request.branchCode}:${request.room}`)!,
      startsAt: manilaTime(ctx.sunday, request.day, request.start),
      endsAt: manilaTime(ctx.sunday, request.day, request.end),
      purpose: request.purpose,
      status: "PENDING",
      requestedById: requester?.id ?? ctx.adminId,
    },
  });

  return { name: "events", summary: `${created} event dates, ${registrations} registrations, 1 pending room request` };
}
