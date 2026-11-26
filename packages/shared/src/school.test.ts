import { describe, expect, it } from "vitest";
import {
  attendanceRate,
  attendanceSaveSchema,
  classCreateSchema,
  classUpdateSchema,
  dateOnlyToUtc,
  enrollmentUpdateSchema,
  sessionCreateSchema,
  teacherAddSchema,
  termCreateSchema,
  termUpdateSchema,
} from "./index";

const BRANCH = "11111111-1111-4111-8111-111111111111";
const TERM = "22222222-2222-4222-8222-222222222222";
const MEMBER = "33333333-3333-4333-8333-333333333333";
const ENROLLMENT = "44444444-4444-4444-8444-444444444444";

describe("attendanceRate", () => {
  it("counts present and late as attended and ignores excused", () => {
    expect(attendanceRate({ PRESENT: 6, LATE: 2, ABSENT: 2, EXCUSED: 5 })).toBe(80);
  });

  it("returns null when nothing countable is recorded", () => {
    expect(attendanceRate({ PRESENT: 0, LATE: 0, ABSENT: 0, EXCUSED: 3 })).toBeNull();
    expect(attendanceRate({})).toBeNull();
  });

  it("rounds to a whole percent", () => {
    expect(attendanceRate({ PRESENT: 2, ABSENT: 1 })).toBe(67);
  });
});

describe("dateOnlyToUtc", () => {
  it("turns a calendar date into UTC midnight", () => {
    expect(dateOnlyToUtc("2026-12-06").toISOString()).toBe("2026-12-06T00:00:00.000Z");
  });
});

describe("termCreateSchema", () => {
  const valid = { name: "2026 Term 2", branchId: BRANCH, startsOn: "2026-11-01", endsOn: "2027-02-28" };

  it("accepts calendar dates", () => {
    expect(termCreateSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects timestamps and impossible dates", () => {
    expect(termCreateSchema.safeParse({ ...valid, startsOn: "2026-11-01T00:00:00Z" }).success).toBe(false);
    expect(termCreateSchema.safeParse({ ...valid, endsOn: "2027-02-30" }).success).toBe(false);
  });

  it("requires the end after the start", () => {
    expect(termCreateSchema.safeParse({ ...valid, endsOn: "2026-10-01" }).success).toBe(false);
  });
});

describe("termUpdateSchema", () => {
  it("rejects an empty update", () => {
    expect(termUpdateSchema.safeParse({}).success).toBe(false);
  });
});

describe("classCreateSchema", () => {
  const valid = { termId: TERM, name: "Grade 3 Bible" };

  it("applies defaults", () => {
    expect(classCreateSchema.parse(valid).audience).toBe("CHILDREN");
  });

  it("validates the weekly schedule", () => {
    expect(classCreateSchema.safeParse({ ...valid, meetingDay: 0, startTime: "09:00", endTime: "10:00" }).success).toBe(true);
    expect(classCreateSchema.safeParse({ ...valid, meetingDay: 7 }).success).toBe(false);
    expect(classCreateSchema.safeParse({ ...valid, startTime: "9am" }).success).toBe(false);
    expect(classCreateSchema.safeParse({ ...valid, startTime: "10:00", endTime: "09:00" }).success).toBe(false);
  });
});

describe("classUpdateSchema", () => {
  it("allows clearing the room and schedule", () => {
    expect(classUpdateSchema.parse({ roomId: null, meetingDay: null })).toEqual({ roomId: null, meetingDay: null });
  });
});

describe("teacherAddSchema", () => {
  it("defaults to LEAD", () => {
    expect(teacherAddSchema.parse({ memberId: MEMBER }).role).toBe("LEAD");
  });
});

describe("enrollmentUpdateSchema", () => {
  it("accepts completing with a grade", () => {
    expect(enrollmentUpdateSchema.safeParse({ status: "COMPLETED", grade: "A" }).success).toBe(true);
  });

  it("only allows a grade when completing", () => {
    expect(enrollmentUpdateSchema.safeParse({ status: "DROPPED", grade: "A" }).success).toBe(false);
  });
});

describe("sessionCreateSchema", () => {
  it("requires a calendar date", () => {
    expect(sessionCreateSchema.safeParse({ date: "2026-12-06", topic: "Creation" }).success).toBe(true);
    expect(sessionCreateSchema.safeParse({ topic: "Creation" }).success).toBe(false);
  });
});

describe("attendanceSaveSchema", () => {
  it("accepts a list of records", () => {
    expect(
      attendanceSaveSchema.safeParse({ records: [{ enrollmentId: ENROLLMENT, status: "PRESENT" }] }).success,
    ).toBe(true);
  });

  it("rejects duplicate enrollments", () => {
    expect(
      attendanceSaveSchema.safeParse({
        records: [
          { enrollmentId: ENROLLMENT, status: "PRESENT" },
          { enrollmentId: ENROLLMENT, status: "ABSENT" },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown status", () => {
    expect(attendanceSaveSchema.safeParse({ records: [{ enrollmentId: ENROLLMENT, status: "ASLEEP" }] }).success).toBe(false);
  });
});
