import { describe, expect, it } from "vitest";
import {
  ministryCreateSchema,
  ministryListQuerySchema,
  ministryMemberAddSchema,
  ministryMemberUpdateSchema,
  ministryRoleCreateSchema,
  ministryUpdateSchema,
} from "./index";

const BRANCH = "11111111-1111-4111-8111-111111111111";
const MEMBER = "22222222-2222-4222-8222-222222222222";

describe("ministryCreateSchema", () => {
  it("accepts the minimum fields and defaults the category to OTHER", () => {
    const result = ministryCreateSchema.parse({ name: "Worship Team", branchId: BRANCH });
    expect(result.category).toBe("OTHER");
  });

  it("treats blank description and schedule as missing", () => {
    const result = ministryCreateSchema.parse({ name: "Ushers", branchId: BRANCH, description: " ", meetingSchedule: "" });
    expect(result.description).toBeUndefined();
    expect(result.meetingSchedule).toBeUndefined();
  });

  it("rejects an unknown category", () => {
    expect(ministryCreateSchema.safeParse({ name: "X", branchId: BRANCH, category: "PARTY" }).success).toBe(false);
  });

  it("requires a name", () => {
    expect(ministryCreateSchema.safeParse({ name: "", branchId: BRANCH }).success).toBe(false);
  });
});

describe("ministryUpdateSchema", () => {
  it("lets blank text clear a field", () => {
    expect(ministryUpdateSchema.parse({ description: "" })).toEqual({ description: null });
  });

  it("accepts toggling active", () => {
    expect(ministryUpdateSchema.safeParse({ isActive: false }).success).toBe(true);
  });

  it("rejects an empty update", () => {
    expect(ministryUpdateSchema.safeParse({}).success).toBe(false);
  });
});

describe("ministryListQuerySchema", () => {
  it("applies defaults and validates the category filter", () => {
    expect(ministryListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(ministryListQuerySchema.safeParse({ category: "YOUTH" }).success).toBe(true);
    expect(ministryListQuerySchema.safeParse({ category: "nope" }).success).toBe(false);
  });
});

describe("ministryRoleCreateSchema", () => {
  it("trims the role name", () => {
    expect(ministryRoleCreateSchema.parse({ name: "  Vocalist " }).name).toBe("Vocalist");
  });
});

describe("ministryMemberAddSchema", () => {
  it("defaults the position to MEMBER", () => {
    expect(ministryMemberAddSchema.parse({ memberId: MEMBER }).position).toBe("MEMBER");
  });

  it("requires a valid member id", () => {
    expect(ministryMemberAddSchema.safeParse({ memberId: "x" }).success).toBe(false);
  });
});

describe("ministryMemberUpdateSchema", () => {
  it("allows clearing the volunteer role", () => {
    expect(ministryMemberUpdateSchema.parse({ ministryRoleId: null })).toEqual({ ministryRoleId: null });
  });

  it("rejects an empty update", () => {
    expect(ministryMemberUpdateSchema.safeParse({}).success).toBe(false);
  });
});
