import { z } from "zod";
import { NON_EMPTY_MESSAGE, nonEmpty, nullableEmail, nullableText, optionalText } from "./fields";
import { CIVIL_STATUSES, GENDERS } from "./members";

/** Everything a QR code carries starts with this, so the app can tell church codes from others. */
export const QR_PREFIX = "cmsqr1.";
export const qrTokenSchema = z.string().trim().startsWith(QR_PREFIX).max(1000);

/** A member scanning the QR posted at a service. */
export const selfCheckInSchema = z.object({ token: qrTokenSchema }).strict();
export type SelfCheckInInput = z.infer<typeof selfCheckInSchema>;

/** An usher scanning a member's personal QR card. */
export const scanCheckInSchema = z.object({ token: qrTokenSchema }).strict();
export type ScanCheckInInput = z.infer<typeof scanCheckInSchema>;

export const JOIN_REQUEST_STATUSES = ["PENDING", "APPROVED", "DECLINED"] as const;
export type JoinRequestStatus = (typeof JOIN_REQUEST_STATUSES)[number];

export const joinRequestCreateSchema = z
  .object({ ministryId: z.uuid(), note: optionalText(300) })
  .strict();
export type JoinRequestCreateInput = z.infer<typeof joinRequestCreateSchema>;

export const joinRequestDecisionSchema = z.object({ decision: z.enum(["APPROVED", "DECLINED"]) }).strict();
export type JoinRequestDecisionInput = z.infer<typeof joinRequestDecisionSchema>;

/** A member registering themselves for an event from the app. */
export const selfRegistrationSchema = z.object({ eventId: z.uuid() }).strict();
export type SelfRegistrationInput = z.infer<typeof selfRegistrationSchema>;

/**
 * What members may change about themselves from the app: contact and personal details only.
 * Names, status, campus, household, and church dates stay with the church office.
 * Blank text clears a field.
 */
export const selfProfileUpdateSchema = z
  .object({
    email: nullableEmail,
    phone: nullableText(40),
    address: nullableText(300),
    occupation: nullableText(100),
    gender: z.enum(GENDERS),
    civilStatus: z.enum(CIVIL_STATUSES).nullable(),
    birthDate: z.coerce
      .date()
      .refine((d) => d.getTime() <= Date.now(), { message: "Date cannot be in the future" })
      .nullable(),
  })
  .partial()
  .strict()
  .refine(nonEmpty, NON_EMPTY_MESSAGE);
export type SelfProfileUpdateInput = z.infer<typeof selfProfileUpdateSchema>;

export const PHOTO_MIME_TYPES = ["image/jpeg", "image/png"] as const;
/** About 512 KB of image once decoded; the app resizes photos to 512 px before sending, well under this. */
export const PHOTO_MAX_BASE64 = 700_000;

/** A profile photo sent from the app as base64; the server also checks the file signature matches the type. */
export const photoUploadSchema = z
  .object({
    mimeType: z.enum(PHOTO_MIME_TYPES),
    data: z
      .string()
      .max(PHOTO_MAX_BASE64)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/, { message: "Photo data must be base64" }),
  })
  .strict();
export type PhotoUploadInput = z.infer<typeof photoUploadSchema>;
