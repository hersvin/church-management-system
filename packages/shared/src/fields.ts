import { z } from "zod";

const isBlank = (v: unknown) => typeof v === "string" && v.trim() === "";

/** Optional text for creates: trims and turns blank strings into undefined. */
export const optionalText = (max: number) =>
  z.preprocess((v) => (isBlank(v) ? undefined : v), z.string().trim().max(max).optional());

/** Nullable text for updates: blank strings become null so a field can be cleared. */
export const nullableText = (max: number) =>
  z.preprocess((v) => (isBlank(v) ? null : v), z.string().trim().max(max).nullable());

export const optionalEmail = z.preprocess(
  (v) => (isBlank(v) ? undefined : v),
  z.string().trim().toLowerCase().pipe(z.email()).optional(),
);

export const nullableEmail = z.preprocess(
  (v) => (isBlank(v) ? null : v),
  z.string().trim().toLowerCase().pipe(z.email()).nullable(),
);

export const optionalSearch = z.preprocess(
  (v) => (isBlank(v) ? undefined : v),
  z.string().trim().max(100).optional(),
);

export const requiredName = z.string().trim().min(1).max(100);

export const nonEmpty = <T extends object>(v: T) => Object.keys(v).length > 0;
export const NON_EMPTY_MESSAGE = { message: "At least one field is required" };
