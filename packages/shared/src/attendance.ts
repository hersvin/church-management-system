import { z } from "zod";
import { NON_EMPTY_MESSAGE, nonEmpty, nullableText, optionalText, requiredName } from "./fields";
import { paginationSchema } from "./schemas";

export const CHECK_IN_KINDS = ["ATTENDEE", "CHILD"] as const;
export type CheckInKind = (typeof CHECK_IN_KINDS)[number];

/** Uppercase letters and digits with look-alikes (0 O, 1 I L, 2 Z, 5 S, 8 B) removed. */
export const PICKUP_CODE_ALPHABET = "ACDEFGHJKMNPQRTUVWXY34679";
export const PICKUP_CODE_LENGTH = 5;
/** Wrong pickup codes allowed before a check-in locks and needs an override. */
export const MAX_PICKUP_ATTEMPTS = 5;
/** Members this age or younger are offered for kids check-in. */
export const CHILD_MAX_AGE = 12;

/**
 * Builds a pickup code. `randomIndex(max)` must return an integer in [0, max);
 * the API passes `crypto.randomInt` so codes are not guessable.
 */
export function generatePickupCode(randomIndex: (max: number) => number): string {
  let code = "";
  for (let i = 0; i < PICKUP_CODE_LENGTH; i++) {
    code += PICKUP_CODE_ALPHABET[randomIndex(PICKUP_CODE_ALPHABET.length)];
  }
  return code;
}

/** Codes are read off printed tags, so case, spaces, and dashes do not matter. */
export function normalizePickupCode(value: string): string {
  return value.toUpperCase().replace(/[\s-]/g, "");
}

/** Whole years between a birth date and a day, both read in UTC. */
export function ageOn(birthDate: Date, on: Date): number {
  let age = on.getUTCFullYear() - birthDate.getUTCFullYear();
  const beforeBirthday =
    on.getUTCMonth() < birthDate.getUTCMonth() ||
    (on.getUTCMonth() === birthDate.getUTCMonth() && on.getUTCDate() < birthDate.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function isLikelyChild(member: { birthDate: Date | null; householdRole: string | null }, on: Date): boolean {
  if (member.birthDate) return ageOn(member.birthDate, on) <= CHILD_MAX_AGE;
  return member.householdRole === "CHILD";
}

export interface CheckInSummary {
  total: number;
  members: number;
  guests: number;
  children: number;
  childrenInCare: number;
}

export function summarizeCheckIns(
  rows: readonly { kind: CheckInKind; memberId: string | null; checkedOutAt: Date | string | null }[],
): CheckInSummary {
  const summary: CheckInSummary = { total: rows.length, members: 0, guests: 0, children: 0, childrenInCare: 0 };
  for (const r of rows) {
    if (r.kind === "CHILD") {
      summary.children += 1;
      if (!r.checkedOutAt) summary.childrenInCare += 1;
    } else if (r.memberId) {
      summary.members += 1;
    } else {
      summary.guests += 1;
    }
  }
  return summary;
}

/** The usher headcount when given, but never fewer than the people checked in. */
export function reportedAttendance(headcount: number | null, checkIns: number): number {
  return Math.max(headcount ?? 0, checkIns);
}

// ---------- Services ----------

const headcount = z.coerce.number().int().min(0).max(100000);

export const serviceCreateSchema = z.object({
  branchId: z.uuid(),
  name: requiredName,
  startsAt: z.coerce.date().refine((d) => !Number.isNaN(d.getTime()), { message: "Invalid date" }),
  headcount: headcount.optional(),
  notes: optionalText(2000),
});
export type ServiceCreateInput = z.infer<typeof serviceCreateSchema>;

export const serviceUpdateSchema = z
  .object({
    name: requiredName,
    startsAt: z.coerce.date(),
    headcount: headcount.nullable(),
    notes: nullableText(2000),
  })
  .partial()
  .strict()
  .refine(nonEmpty, NON_EMPTY_MESSAGE);
export type ServiceUpdateInput = z.infer<typeof serviceUpdateSchema>;

export const serviceListQuerySchema = paginationSchema
  .extend({
    branchId: z.uuid().optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .refine((r) => !r.from || !r.to || r.to > r.from, { message: "'to' must be after 'from'", path: ["to"] });
export type ServiceListQuery = z.infer<typeof serviceListQuerySchema>;

export const attendanceStatsQuerySchema = z.object({
  branchId: z.uuid().optional(),
  weeks: z.coerce.number().int().min(1).max(26).default(8),
});
export type AttendanceStatsQuery = z.infer<typeof attendanceStatsQuerySchema>;

// ---------- Check-in ----------

const attendeeCheckIn = z.object({
  kind: z.literal("ATTENDEE"),
  memberId: z.uuid().optional(),
  guestName: optionalText(150),
  guestPhone: optionalText(40),
});

const childCheckIn = z.object({
  kind: z.literal("CHILD"),
  memberId: z.uuid(),
  guardianMemberId: z.uuid().optional(),
  guardianName: optionalText(150),
  guardianPhone: optionalText(40),
  careNote: optionalText(500),
});

export const checkInCreateSchema = z.discriminatedUnion("kind", [attendeeCheckIn, childCheckIn]).superRefine((c, ctx) => {
  if (c.kind === "ATTENDEE") {
    if (Boolean(c.memberId) === Boolean(c.guestName)) {
      ctx.addIssue({ code: "custom", message: "Provide either a member or a guest name", path: ["memberId"] });
    }
    return;
  }
  if (Boolean(c.guardianMemberId) === Boolean(c.guardianName)) {
    ctx.addIssue({ code: "custom", message: "Provide either a guardian member or a guardian name", path: ["guardianMemberId"] });
  }
  if (c.guardianName && !c.guardianPhone) {
    ctx.addIssue({ code: "custom", message: "A guardian who is not a member needs a phone number", path: ["guardianPhone"] });
  }
  if (c.guardianMemberId && c.guardianMemberId === c.memberId) {
    ctx.addIssue({ code: "custom", message: "A child cannot be their own guardian", path: ["guardianMemberId"] });
  }
});
export type CheckInCreateInput = z.infer<typeof checkInCreateSchema>;

const pickedUpBy = {
  pickedUpByMemberId: z.uuid().optional(),
  pickedUpByName: optionalText(150),
};

export const checkOutSchema = z
  .discriminatedUnion("method", [
    z.object({
      method: z.literal("CODE"),
      code: z
        .string()
        .transform(normalizePickupCode)
        .pipe(z.string().length(PICKUP_CODE_LENGTH, `Pickup codes have ${PICKUP_CODE_LENGTH} characters`)),
      ...pickedUpBy,
    }),
    z.object({
      method: z.literal("OVERRIDE"),
      reason: z.string().trim().min(5).max(500),
      ...pickedUpBy,
    }),
  ])
  .refine((c) => Boolean(c.pickedUpByMemberId) !== Boolean(c.pickedUpByName), {
    message: "Record who collected the child",
    path: ["pickedUpByMemberId"],
  });
export type CheckOutInput = z.infer<typeof checkOutSchema>;

/** Manila is UTC+8 with no daylight saving. */
export const CHURCH_UTC_OFFSET_MINUTES = 480;

/** The local Sunday (YYYY-MM-DD) that starts the week containing `date`. */
export function weekStartKey(date: Date, utcOffsetMinutes = CHURCH_UTC_OFFSET_MINUTES): string {
  const local = new Date(date.getTime() + utcOffsetMinutes * 60 * 1000);
  const sunday = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - local.getUTCDay());
  return new Date(sunday).toISOString().slice(0, 10);
}
