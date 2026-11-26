import { z } from "zod";
import { nullableEmail, nullableText, optionalEmail, optionalSearch, optionalText, requiredName } from "./fields";
import { paginationSchema } from "./schemas";

export const MEMBER_STATUSES = ["VISITOR", "REGULAR", "MEMBER", "INACTIVE"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const GENDERS = ["MALE", "FEMALE", "UNSPECIFIED"] as const;
export type Gender = (typeof GENDERS)[number];

export const CIVIL_STATUSES = ["SINGLE", "MARRIED", "WIDOWED", "SEPARATED"] as const;
export type CivilStatus = (typeof CIVIL_STATUSES)[number];

export const HOUSEHOLD_ROLES = ["HEAD", "SPOUSE", "CHILD", "OTHER"] as const;
export type HouseholdRole = (typeof HOUSEHOLD_ROLES)[number];

const pastDate = z.coerce
  .date()
  .refine((d) => d.getTime() <= Date.now(), { message: "Date cannot be in the future" });

const name = requiredName;

const memberFields = {
  firstName: name,
  middleName: optionalText(100),
  lastName: name,
  suffix: optionalText(20),
  gender: z.enum(GENDERS).default("UNSPECIFIED"),
  civilStatus: z.enum(CIVIL_STATUSES).optional(),
  birthDate: pastDate.optional(),
  email: optionalEmail,
  phone: optionalText(40),
  address: optionalText(300),
  occupation: optionalText(100),
  status: z.enum(MEMBER_STATUSES).default("VISITOR"),
  membershipDate: pastDate.optional(),
  baptismDate: pastDate.optional(),
  notes: optionalText(2000),
  branchId: z.uuid(),
  householdId: z.uuid().optional(),
  householdRole: z.enum(HOUSEHOLD_ROLES).optional(),
};

export const memberCreateSchema = z
  .object(memberFields)
  .refine((m) => !m.householdId || m.householdRole, {
    message: "Household role is required when a household is set",
    path: ["householdRole"],
  });
export type MemberCreateInput = z.infer<typeof memberCreateSchema>;

export const memberUpdateSchema = z
  .object({
    ...memberFields,
    middleName: nullableText(100),
    suffix: nullableText(20),
    email: nullableEmail,
    phone: nullableText(40),
    address: nullableText(300),
    occupation: nullableText(100),
    notes: nullableText(2000),
    gender: z.enum(GENDERS),
    status: z.enum(MEMBER_STATUSES),
    civilStatus: z.enum(CIVIL_STATUSES).nullable(),
    birthDate: pastDate.nullable(),
    membershipDate: pastDate.nullable(),
    baptismDate: pastDate.nullable(),
    householdId: z.uuid().nullable(),
    householdRole: z.enum(HOUSEHOLD_ROLES).nullable(),
    statusNote: optionalText(500),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });
export type MemberUpdateInput = z.infer<typeof memberUpdateSchema>;

export const memberListQuerySchema = paginationSchema.extend({
  search: optionalSearch,
  status: z.enum(MEMBER_STATUSES).optional(),
  branchId: z.uuid().optional(),
  householdId: z.uuid().optional(),
});
export type MemberListQuery = z.infer<typeof memberListQuerySchema>;

export const householdCreateSchema = z.object({
  name,
  address: optionalText(300),
  phone: optionalText(40),
  branchId: z.uuid(),
});
export type HouseholdCreateInput = z.infer<typeof householdCreateSchema>;

export const householdUpdateSchema = householdCreateSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });
export type HouseholdUpdateInput = z.infer<typeof householdUpdateSchema>;

export const householdListQuerySchema = paginationSchema.extend({
  search: optionalSearch,
  branchId: z.uuid().optional(),
});
export type HouseholdListQuery = z.infer<typeof householdListQuerySchema>;
