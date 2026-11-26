import { describe, expect, it } from "vitest";
import {
  householdCreateSchema,
  householdListQuerySchema,
  memberCreateSchema,
  memberListQuerySchema,
  memberUpdateSchema,
} from "./index";

const BRANCH = "11111111-1111-4111-8111-111111111111";

describe("memberCreateSchema", () => {
  const valid = { firstName: "Ana", lastName: "Cruz", branchId: BRANCH };

  it("accepts the minimum fields and defaults status to VISITOR", () => {
    const result = memberCreateSchema.parse(valid);
    expect(result.status).toBe("VISITOR");
    expect(result.gender).toBe("UNSPECIFIED");
  });

  it("coerces ISO date strings", () => {
    const result = memberCreateSchema.parse({ ...valid, birthDate: "1990-05-17" });
    expect(result.birthDate).toBeInstanceOf(Date);
  });

  it("rejects a birth date in the future", () => {
    expect(memberCreateSchema.safeParse({ ...valid, birthDate: "2999-01-01" }).success).toBe(false);
  });

  it("treats empty optional strings as missing", () => {
    const result = memberCreateSchema.parse({ ...valid, email: "", phone: "  " });
    expect(result.email).toBeUndefined();
    expect(result.phone).toBeUndefined();
  });

  it("rejects an invalid email", () => {
    expect(memberCreateSchema.safeParse({ ...valid, email: "nope" }).success).toBe(false);
  });

  it("requires a household role when a household is set", () => {
    expect(
      memberCreateSchema.safeParse({ ...valid, householdId: BRANCH }).success,
    ).toBe(false);
    expect(
      memberCreateSchema.safeParse({ ...valid, householdId: BRANCH, householdRole: "HEAD" }).success,
    ).toBe(true);
  });

  it("rejects an unknown status", () => {
    expect(memberCreateSchema.safeParse({ ...valid, status: "SAINT" }).success).toBe(false);
  });
});

describe("memberUpdateSchema", () => {
  it("accepts a partial update with a status note", () => {
    expect(memberUpdateSchema.safeParse({ status: "MEMBER", statusNote: "Completed class" }).success).toBe(true);
  });

  it("allows clearing nullable fields", () => {
    expect(memberUpdateSchema.parse({ householdId: null }).householdId).toBeNull();
  });

  it("turns blank text into null so optional text can be cleared", () => {
    const result = memberUpdateSchema.parse({ middleName: "  ", email: "", phone: null });
    expect(result).toEqual({ middleName: null, email: null, phone: null });
  });

  it("rejects an empty update", () => {
    expect(memberUpdateSchema.safeParse({}).success).toBe(false);
  });
});

describe("memberListQuerySchema", () => {
  it("applies pagination defaults and trims search", () => {
    expect(memberListQuerySchema.parse({ search: "  ana " })).toEqual({ page: 1, pageSize: 20, search: "ana" });
  });

  it("drops an empty search", () => {
    expect(memberListQuerySchema.parse({ search: "" }).search).toBeUndefined();
  });

  it("validates the status filter", () => {
    expect(memberListQuerySchema.safeParse({ status: "MEMBER" }).success).toBe(true);
    expect(memberListQuerySchema.safeParse({ status: "x" }).success).toBe(false);
  });
});

describe("householdCreateSchema", () => {
  it("accepts a household", () => {
    expect(householdCreateSchema.safeParse({ name: "Cruz Family", branchId: BRANCH }).success).toBe(true);
  });

  it("requires a name", () => {
    expect(householdCreateSchema.safeParse({ name: " ", branchId: BRANCH }).success).toBe(false);
  });
});

describe("householdListQuerySchema", () => {
  it("applies defaults", () => {
    expect(householdListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });
});
