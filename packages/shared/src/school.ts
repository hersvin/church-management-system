import { z } from "zod";
import { NON_EMPTY_MESSAGE, nonEmpty, nullableText, optionalSearch, optionalText, requiredName } from "./fields";
import { paginationSchema } from "./schemas";

export const CLASS_AUDIENCES = ["CHILDREN", "YOUTH", "ADULTS"] as const;
export type ClassAudience = (typeof CLASS_AUDIENCES)[number];

export const TEACHER_ROLES = ["LEAD", "ASSISTANT"] as const;
export type TeacherRole = (typeof TEACHER_ROLES)[number];

export const ENROLLMENT_STATUSES = ["ENROLLED", "COMPLETED", "DROPPED"] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

export const ATTENDANCE_STATUSES = ["PRESENT", "LATE", "ABSENT", "EXCUSED"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

/**
 * Share of countable sessions attended, as a whole percent. Present and late
 * count as attended; excused sessions are left out entirely. Null when there
 * is nothing to count yet.
 */
export function attendanceRate(counts: Partial<Record<AttendanceStatus, number>>): number | null {
  const attended = (counts.PRESENT ?? 0) + (counts.LATE ?? 0);
  const countable = attended + (counts.ABSENT ?? 0);
  return countable === 0 ? null : Math.round((attended / countable) * 100);
}

/** A calendar date (YYYY-MM-DD) as UTC midnight, matching Postgres DATE columns. */
export function dateOnlyToUtc(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

// The refine rejects impossible dates such as 2027-02-30. It must not throw on malformed input,
// because Zod still runs it after the format check has already failed.
const dateOnly = z.iso.date().refine(
  (v) => {
    const d = dateOnlyToUtc(v);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  },
  { message: "Invalid calendar date" },
);

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM");

// ---------- Terms ----------

export const termCreateSchema = z
  .object({
    name: requiredName,
    branchId: z.uuid(),
    startsOn: dateOnly,
    endsOn: dateOnly,
  })
  .refine((t) => t.endsOn > t.startsOn, { message: "End must be after start", path: ["endsOn"] });
export type TermCreateInput = z.infer<typeof termCreateSchema>;

export const termUpdateSchema = z
  .object({ name: requiredName, startsOn: dateOnly, endsOn: dateOnly })
  .partial()
  .strict()
  .refine(nonEmpty, NON_EMPTY_MESSAGE)
  .refine((t) => !t.startsOn || !t.endsOn || t.endsOn > t.startsOn, { message: "End must be after start", path: ["endsOn"] });
export type TermUpdateInput = z.infer<typeof termUpdateSchema>;

export const termListQuerySchema = z.object({ branchId: z.uuid().optional() });

// ---------- Classes ----------

const scheduleRefine = <T extends { startTime?: string | null; endTime?: string | null }>(c: T) =>
  !c.startTime || !c.endTime || c.endTime > c.startTime;

export const classCreateSchema = z
  .object({
    termId: z.uuid(),
    name: requiredName,
    description: optionalText(2000),
    audience: z.enum(CLASS_AUDIENCES).default("CHILDREN"),
    ageRange: optionalText(40),
    meetingDay: z.coerce.number().int().min(0).max(6).optional(),
    startTime: time.optional(),
    endTime: time.optional(),
    roomId: z.uuid().optional(),
    capacity: z.coerce.number().int().positive().max(1000).optional(),
  })
  .refine(scheduleRefine, { message: "End time must be after start time", path: ["endTime"] });
export type ClassCreateInput = z.infer<typeof classCreateSchema>;

export const classUpdateSchema = z
  .object({
    name: requiredName,
    description: nullableText(2000),
    audience: z.enum(CLASS_AUDIENCES),
    ageRange: nullableText(40),
    meetingDay: z.number().int().min(0).max(6).nullable(),
    startTime: time.nullable(),
    endTime: time.nullable(),
    roomId: z.uuid().nullable(),
    capacity: z.number().int().positive().max(1000).nullable(),
  })
  .partial()
  .strict()
  .refine(nonEmpty, NON_EMPTY_MESSAGE)
  .refine(scheduleRefine, { message: "End time must be after start time", path: ["endTime"] });
export type ClassUpdateInput = z.infer<typeof classUpdateSchema>;

export const classListQuerySchema = paginationSchema.extend({
  termId: z.uuid().optional(),
  audience: z.enum(CLASS_AUDIENCES).optional(),
  search: optionalSearch,
  branchId: z.uuid().optional(),
});
export type ClassListQuery = z.infer<typeof classListQuerySchema>;

// ---------- Teachers and enrollment ----------

export const teacherAddSchema = z.object({
  memberId: z.uuid(),
  role: z.enum(TEACHER_ROLES).default("LEAD"),
});
export type TeacherAddInput = z.infer<typeof teacherAddSchema>;

export const enrollmentCreateSchema = z.object({ memberId: z.uuid() });
export type EnrollmentCreateInput = z.infer<typeof enrollmentCreateSchema>;

export const enrollmentUpdateSchema = z
  .object({
    status: z.enum(["COMPLETED", "DROPPED"]),
    grade: optionalText(20),
    note: optionalText(500),
  })
  .refine((e) => !e.grade || e.status === "COMPLETED", { message: "A grade is only given on completion", path: ["grade"] });
export type EnrollmentUpdateInput = z.infer<typeof enrollmentUpdateSchema>;

// ---------- Sessions and attendance ----------

export const sessionCreateSchema = z.object({
  date: dateOnly,
  topic: optionalText(200),
  notes: optionalText(2000),
});
export type SessionCreateInput = z.infer<typeof sessionCreateSchema>;

export const attendanceSaveSchema = z.object({
  records: z
    .array(
      z.object({
        enrollmentId: z.uuid(),
        status: z.enum(ATTENDANCE_STATUSES),
        note: optionalText(200),
      }),
    )
    .min(1)
    .max(500)
    .refine((r) => new Set(r.map((x) => x.enrollmentId)).size === r.length, { message: "Each student can appear once" }),
});
export type AttendanceSaveInput = z.infer<typeof attendanceSaveSchema>;

export const schoolStatsQuerySchema = z.object({ branchId: z.uuid().optional() });
