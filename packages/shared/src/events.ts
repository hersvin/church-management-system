import { z } from "zod";
import {
  NON_EMPTY_MESSAGE,
  nonEmpty,
  nullableText,
  optionalEmail,
  optionalSearch,
  optionalText,
  requiredName,
} from "./fields";
import { REPEAT_FREQUENCIES } from "./scheduling";
import { paginationSchema } from "./schemas";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const BOOKING_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const EVENT_CATEGORIES = ["SERVICE", "MEETING", "CLASS", "OUTREACH", "FELLOWSHIP", "CONFERENCE", "OTHER"] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const EVENT_STATUSES = ["SCHEDULED", "CANCELLED"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const CANCEL_SCOPES = ["THIS", "FOLLOWING"] as const;

const features = z
  .array(z.string().trim().min(1).max(40))
  .max(20)
  .transform((list) => {
    const seen = new Set<string>();
    return list.filter((f) => {
      const key = f.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });

const blankToNull = (v: unknown) => (v === "" ? null : v);

// ---------- Rooms ----------

/** Hourly hire rate in pesos, to the centavo. Blank means no rate is set. */
const hourlyRate = z.coerce.number().min(0).max(1_000_000).multipleOf(0.01, "Use at most two decimals");
const blankToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

export const roomCreateSchema = z.object({
  name: requiredName,
  branchId: z.uuid(),
  capacity: z.coerce.number().int().positive().max(100000).optional(),
  location: optionalText(200),
  description: optionalText(1000),
  features: features.default([]),
  hourlyRate: z.preprocess(blankToUndefined, hourlyRate.optional()),
});
export type RoomCreateInput = z.infer<typeof roomCreateSchema>;

export const roomUpdateSchema = z
  .object({
    name: requiredName,
    capacity: z.preprocess(blankToNull, z.coerce.number().int().positive().max(100000).nullable()),
    location: nullableText(200),
    description: nullableText(1000),
    features,
    isActive: z.boolean(),
    hourlyRate: z.preprocess(blankToNull, hourlyRate.nullable()),
  })
  .partial()
  .strict()
  .refine(nonEmpty, NON_EMPTY_MESSAGE);
export type RoomUpdateInput = z.infer<typeof roomUpdateSchema>;

export const roomListQuerySchema = paginationSchema.extend({
  search: optionalSearch,
  branchId: z.uuid().optional(),
});
export type RoomListQuery = z.infer<typeof roomListQuerySchema>;

// ---------- Calendar ranges ----------

const MAX_RANGE_DAYS = 120;

export const calendarRangeSchema = z
  .object({ from: z.coerce.date(), to: z.coerce.date() })
  .refine((r) => r.to > r.from, { message: "'to' must be after 'from'", path: ["to"] })
  .refine((r) => r.to.getTime() - r.from.getTime() <= MAX_RANGE_DAYS * DAY, {
    message: `Range cannot exceed ${MAX_RANGE_DAYS} days`,
    path: ["to"],
  });

// ---------- Bookings ----------

export const bookingCreateSchema = z
  .object({
    roomId: z.uuid(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    purpose: z.string().trim().min(1).max(200),
  })
  .refine((b) => b.endsAt > b.startsAt, { message: "End must be after start", path: ["endsAt"] })
  .refine((b) => b.endsAt.getTime() - b.startsAt.getTime() <= DAY, {
    message: "A booking cannot be longer than 24 hours",
    path: ["endsAt"],
  });
export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;

export const bookingDecisionSchema = z.object({ note: optionalText(500) });
export type BookingDecisionInput = z.infer<typeof bookingDecisionSchema>;

export const bookingListQuerySchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
    roomId: z.uuid().optional(),
    status: z.enum(BOOKING_STATUSES).optional(),
    branchId: z.uuid().optional(),
  })
  .refine((r) => r.to > r.from, { message: "'to' must be after 'from'", path: ["to"] })
  .refine((r) => r.to.getTime() - r.from.getTime() <= MAX_RANGE_DAYS * DAY, {
    message: `Range cannot exceed ${MAX_RANGE_DAYS} days`,
    path: ["to"],
  });
export type BookingListQuery = z.infer<typeof bookingListQuerySchema>;

export const pendingBookingsQuerySchema = z.object({ branchId: z.uuid().optional() });

// ---------- Events ----------

const repeatSchema = z.object({
  frequency: z.enum(REPEAT_FREQUENCIES),
  until: z.coerce.date(),
});

export const eventCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(150),
    description: optionalText(4000),
    category: z.enum(EVENT_CATEGORIES).default("OTHER"),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    branchId: z.uuid(),
    ministryId: z.uuid().optional(),
    roomId: z.uuid().optional(),
    capacity: z.coerce.number().int().positive().max(100000).optional(),
    registrationRequired: z.boolean().default(false),
    repeat: repeatSchema.optional(),
  })
  .refine((e) => e.endsAt > e.startsAt, { message: "End must be after start", path: ["endsAt"] })
  .refine((e) => e.endsAt.getTime() - e.startsAt.getTime() <= 14 * DAY, {
    message: "An event cannot be longer than 14 days",
    path: ["endsAt"],
  })
  .refine((e) => !e.repeat || e.repeat.until >= e.startsAt, {
    message: "Repeat end must be on or after the first date",
    path: ["repeat", "until"],
  });
export type EventCreateInput = z.infer<typeof eventCreateSchema>;

export const eventUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(150),
    description: nullableText(4000),
    category: z.enum(EVENT_CATEGORIES),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    ministryId: z.uuid().nullable(),
    roomId: z.uuid().nullable(),
    capacity: z.preprocess(blankToNull, z.coerce.number().int().positive().max(100000).nullable()),
    registrationRequired: z.boolean(),
  })
  .partial()
  .strict()
  .refine(nonEmpty, NON_EMPTY_MESSAGE)
  .refine((e) => !e.startsAt || !e.endsAt || e.endsAt > e.startsAt, {
    message: "End must be after start",
    path: ["endsAt"],
  });
export type EventUpdateInput = z.infer<typeof eventUpdateSchema>;

export const eventListQuerySchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
    search: optionalSearch,
    category: z.enum(EVENT_CATEGORIES).optional(),
    ministryId: z.uuid().optional(),
    roomId: z.uuid().optional(),
    branchId: z.uuid().optional(),
    includeCancelled: z.stringbool().optional(),
  })
  .refine((r) => r.to > r.from, { message: "'to' must be after 'from'", path: ["to"] })
  .refine((r) => r.to.getTime() - r.from.getTime() <= MAX_RANGE_DAYS * DAY, {
    message: `Range cannot exceed ${MAX_RANGE_DAYS} days`,
    path: ["to"],
  });
export type EventListQuery = z.infer<typeof eventListQuerySchema>;

export const eventCancelSchema = z.object({
  scope: z.enum(CANCEL_SCOPES).default("THIS"),
  reason: optionalText(500),
});
export type EventCancelInput = z.infer<typeof eventCancelSchema>;

export const upcomingEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(5),
  branchId: z.uuid().optional(),
});

// ---------- Registrations ----------

export const registrationCreateSchema = z
  .object({
    memberId: z.uuid().optional(),
    guestName: optionalText(150),
    guestEmail: optionalEmail,
    guestPhone: optionalText(40),
  })
  .refine((r) => Boolean(r.memberId) !== Boolean(r.guestName), {
    message: "Provide either a member or a guest name",
    path: ["memberId"],
  });
export type RegistrationCreateInput = z.infer<typeof registrationCreateSchema>;
