import { splitName, toDate, type SeedContext, type SeedResult } from "../context";
import { SAMPLE_CLASSES, SAMPLE_TERMS, pastSessionDates, sampleAttendance, termDates } from "../data";

/**
 * Terms, classes, teachers, enrollments, and past sessions with attendance.
 * Dates are relative to the next Sunday, so this only runs when the sample terms do not exist yet.
 */
export async function seedSchool(ctx: SeedContext): Promise<SeedResult> {
  const { prisma } = ctx;
  if ((await prisma.schoolTerm.count({ where: { name: SAMPLE_TERMS[0].name, deletedAt: null } })) > 0) {
    return { name: "school", summary: "already seeded, skipped" };
  }

  const termIds = new Map<string, { id: string; startsOn: string }>();
  for (const term of SAMPLE_TERMS) {
    const dates = termDates(ctx.sunday, term);
    const row = await prisma.schoolTerm.create({
      data: {
        name: term.name,
        branchId: ctx.branchIds.get(term.branchCode)!,
        startsOn: toDate(dates.startsOn)!,
        endsOn: toDate(dates.endsOn)!,
      },
    });
    termIds.set(term.branchCode, { id: row.id, startsOn: dates.startsOn });
  }

  const findPerson = (person: string, branchId: string) =>
    prisma.member.findFirst({ where: { ...splitName(person), branchId, deletedAt: null } });

  let enrollments = 0;
  let sessions = 0;
  let marks = 0;
  for (const { teachers, students, branchCode, room, ...fields } of SAMPLE_CLASSES) {
    const branchId = ctx.branchIds.get(branchCode)!;
    const term = termIds.get(branchCode)!;
    const klass = await prisma.schoolClass.create({
      data: { ...fields, termId: term.id, roomId: room ? ctx.roomIds.get(`${branchCode}:${room}`) : undefined },
    });

    for (const t of teachers) {
      const member = await findPerson(t.person, branchId);
      if (member) await prisma.classTeacher.create({ data: { classId: klass.id, memberId: member.id, role: t.role } });
    }

    const dates = pastSessionDates(term.startsOn, fields.meetingDay, ctx.now);
    // A dropped student leaves after attending the first half of the sessions.
    const dropAfter = Math.max(1, Math.floor(dates.length / 2));

    const roster: { id: string; dropped: boolean }[] = [];
    for (const s of students) {
      const member = await findPerson(s.person, branchId);
      if (!member) continue;
      const enrollment = await prisma.enrollment.create({
        data: {
          classId: klass.id,
          memberId: member.id,
          enrolledAt: toDate(term.startsOn)!,
          ...(s.dropped
            ? { status: "DROPPED", droppedAt: toDate(dates[dropAfter - 1] ?? term.startsOn), note: "Moved to evening shift" }
            : {}),
        },
      });
      roster.push({ id: enrollment.id, dropped: Boolean(s.dropped) });
      enrollments += 1;
    }

    for (const [sessionIndex, date] of dates.entries()) {
      const session = await prisma.classSession.create({
        data: { classId: klass.id, date: toDate(date)!, topic: `Lesson ${sessionIndex + 1}` },
      });
      sessions += 1;
      for (const [studentIndex, e] of roster.entries()) {
        if (e.dropped && sessionIndex >= dropAfter) continue;
        await prisma.sessionAttendance.create({
          data: {
            sessionId: session.id,
            enrollmentId: e.id,
            status: sampleAttendance(studentIndex, sessionIndex),
            recordedById: ctx.adminId,
          },
        });
        marks += 1;
      }
    }
  }

  return {
    name: "school",
    summary: `${SAMPLE_TERMS.length} terms, ${SAMPLE_CLASSES.length} classes, ${enrollments} enrollments, ${sessions} sessions, ${marks} attendance marks`,
  };
}
