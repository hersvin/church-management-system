import { z } from "zod";
import { NON_EMPTY_MESSAGE, nonEmpty, nullableText, optionalSearch, optionalText, requiredName } from "./fields";
import { paginationSchema } from "./schemas";

export const MINISTRY_CATEGORIES = [
  "WORSHIP",
  "CHILDREN",
  "YOUTH",
  "ADULTS",
  "OUTREACH",
  "PRAYER",
  "HOSPITALITY",
  "MEDIA",
  "OTHER",
] as const;
export type MinistryCategory = (typeof MINISTRY_CATEGORIES)[number];

export const MINISTRY_POSITIONS = ["LEADER", "COLEADER", "MEMBER"] as const;
export type MinistryPosition = (typeof MINISTRY_POSITIONS)[number];

export const ministryCreateSchema = z.object({
  name: requiredName,
  description: optionalText(2000),
  category: z.enum(MINISTRY_CATEGORIES).default("OTHER"),
  meetingSchedule: optionalText(200),
  branchId: z.uuid(),
});
export type MinistryCreateInput = z.infer<typeof ministryCreateSchema>;

export const ministryUpdateSchema = z
  .object({
    name: requiredName,
    description: nullableText(2000),
    category: z.enum(MINISTRY_CATEGORIES),
    meetingSchedule: nullableText(200),
    branchId: z.uuid(),
    isActive: z.boolean(),
  })
  .partial()
  .strict()
  .refine(nonEmpty, NON_EMPTY_MESSAGE);
export type MinistryUpdateInput = z.infer<typeof ministryUpdateSchema>;

export const ministryListQuerySchema = paginationSchema.extend({
  search: optionalSearch,
  category: z.enum(MINISTRY_CATEGORIES).optional(),
  branchId: z.uuid().optional(),
});
export type MinistryListQuery = z.infer<typeof ministryListQuerySchema>;

export const ministryRoleCreateSchema = z.object({ name: z.string().trim().min(1).max(60) });
export type MinistryRoleCreateInput = z.infer<typeof ministryRoleCreateSchema>;

export const ministryMemberAddSchema = z.object({
  memberId: z.uuid(),
  position: z.enum(MINISTRY_POSITIONS).default("MEMBER"),
  ministryRoleId: z.uuid().optional(),
});
export type MinistryMemberAddInput = z.infer<typeof ministryMemberAddSchema>;

export const ministryMemberUpdateSchema = z
  .object({
    position: z.enum(MINISTRY_POSITIONS),
    ministryRoleId: z.uuid().nullable(),
  })
  .partial()
  .strict()
  .refine(nonEmpty, NON_EMPTY_MESSAGE);
export type MinistryMemberUpdateInput = z.infer<typeof ministryMemberUpdateSchema>;
