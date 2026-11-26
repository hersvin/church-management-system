import { z } from "zod";
import { ROLE_KEYS } from "./permissions";

const name = z.string().trim().min(1).max(100);
const email = z.string().trim().toLowerCase().pipe(z.email());

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(200);

export const userCreateSchema = z.object({
  email,
  password: passwordSchema,
  firstName: name,
  lastName: name,
  roleKey: z.enum(ROLE_KEYS),
  branchId: z.uuid().nullable(),
});
export type UserCreateInput = z.infer<typeof userCreateSchema>;

export const userUpdateSchema = z
  .object({
    firstName: name,
    lastName: name,
    roleKey: z.enum(ROLE_KEYS),
    branchId: z.uuid().nullable(),
    isActive: z.boolean(),
    /** Member record this account belongs to (for the mobile app); null removes the link. */
    memberId: z.uuid().nullable(),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

export const branchCreateSchema = z.object({
  name,
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{2,20}$/, "Code must be 2 to 20 letters, digits, dashes or underscores"),
  address: z.string().trim().max(300).optional(),
  phone: z.string().trim().max(40).optional(),
  email: email.optional(),
});
export type BranchCreateInput = z.infer<typeof branchCreateSchema>;

export const branchUpdateSchema = branchCreateSchema
  .extend({ isActive: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });
export type BranchUpdateInput = z.infer<typeof branchUpdateSchema>;

const jsonValue: z.ZodType<unknown> = z.json();

export const settingUpsertSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/, "Key must be dot-separated lowercase"),
  value: jsonValue,
  branchId: z.uuid().nullable().optional(),
});
export type SettingUpsertInput = z.infer<typeof settingUpsertSchema>;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationInput = z.infer<typeof paginationSchema>;
