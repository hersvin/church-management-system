import { describe, expect, it } from "vitest";
import { joinRequestCreateSchema, joinRequestDecisionSchema, PHOTO_MAX_BASE64, photoUploadSchema, selfCheckInSchema, selfProfileUpdateSchema } from "./app";

const ID = "11111111-1111-4111-8111-111111111111";

describe("app schemas", () => {
  it("accepts only church QR tokens", () => {
    expect(selfCheckInSchema.safeParse({ token: "cmsqr1.abc.def" }).success).toBe(true);
    expect(selfCheckInSchema.safeParse({ token: "https://evil.example" }).success).toBe(false);
    expect(selfCheckInSchema.safeParse({ token: `cmsqr1.${"x".repeat(2000)}` }).success).toBe(false);
    expect(selfCheckInSchema.safeParse({ token: "cmsqr1.a", extra: 1 }).success).toBe(false);
  });

  it("validates join requests and decisions", () => {
    expect(joinRequestCreateSchema.parse({ ministryId: ID, note: "  " })).toEqual({ ministryId: ID });
    expect(joinRequestCreateSchema.safeParse({ ministryId: "worship" }).success).toBe(false);
    expect(joinRequestDecisionSchema.safeParse({ decision: "APPROVED" }).success).toBe(true);
    expect(joinRequestDecisionSchema.safeParse({ decision: "PENDING" }).success).toBe(false);
  });

  describe("self profile update", () => {
    it("lets a member edit their own contact and personal details", () => {
      expect(
        selfProfileUpdateSchema.parse({ phone: " 0917 000 0000 ", email: "ME@Example.com", address: "", civilStatus: "MARRIED" }),
      ).toEqual({ phone: "0917 000 0000", email: "me@example.com", address: null, civilStatus: "MARRIED" });
      expect(selfProfileUpdateSchema.parse({ birthDate: "1990-04-12" }).birthDate).toBeInstanceOf(Date);
    });

    it("refuses office-managed fields, future birthdays, and empty updates", () => {
      expect(selfProfileUpdateSchema.safeParse({ status: "MEMBER" }).success).toBe(false);
      expect(selfProfileUpdateSchema.safeParse({ firstName: "X" }).success).toBe(false);
      expect(selfProfileUpdateSchema.safeParse({ branchId: ID }).success).toBe(false);
      expect(selfProfileUpdateSchema.safeParse({ birthDate: "2999-01-01" }).success).toBe(false);
      expect(selfProfileUpdateSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
      expect(selfProfileUpdateSchema.safeParse({}).success).toBe(false);
    });
  });

  describe("photo upload", () => {
    it("accepts a base64 JPEG or PNG", () => {
      expect(photoUploadSchema.safeParse({ mimeType: "image/jpeg", data: "/9j/4AAQSkZJRg==" }).success).toBe(true);
      expect(photoUploadSchema.safeParse({ mimeType: "image/png", data: "iVBORw0KGgo=" }).success).toBe(true);
    });

    it("refuses other types, non-base64 text, and oversized images", () => {
      expect(photoUploadSchema.safeParse({ mimeType: "image/gif", data: "R0lGOD==" }).success).toBe(false);
      expect(photoUploadSchema.safeParse({ mimeType: "image/jpeg", data: "not base64!" }).success).toBe(false);
      expect(photoUploadSchema.safeParse({ mimeType: "image/jpeg", data: "A".repeat(PHOTO_MAX_BASE64 + 4) }).success).toBe(false);
    });
  });
});
