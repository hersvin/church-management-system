import { describe, expect, it } from "vitest";
import {
  ageOn,
  checkInCreateSchema,
  checkOutSchema,
  generatePickupCode,
  isLikelyChild,
  MAX_PICKUP_ATTEMPTS,
  normalizePickupCode,
  PICKUP_CODE_ALPHABET,
  PICKUP_CODE_LENGTH,
  reportedAttendance,
  serviceCreateSchema,
  serviceListQuerySchema,
  serviceUpdateSchema,
  summarizeCheckIns,
  weekStartKey,
} from "./index";

const BRANCH = "11111111-1111-4111-8111-111111111111";
const MEMBER = "33333333-3333-4333-8333-333333333333";
const GUARDIAN = "55555555-5555-4555-8555-555555555555";

describe("generatePickupCode", () => {
  it("builds a code of the fixed length from the unambiguous alphabet", () => {
    let i = 0;
    const code = generatePickupCode(() => i++);
    expect(code).toHaveLength(PICKUP_CODE_LENGTH);
    expect(code).toBe(PICKUP_CODE_ALPHABET.slice(0, PICKUP_CODE_LENGTH));
  });

  it("asks the random source for an index below the alphabet size", () => {
    const seen: number[] = [];
    generatePickupCode((max) => {
      seen.push(max);
      return max - 1;
    });
    expect(seen.every((m) => m === PICKUP_CODE_ALPHABET.length)).toBe(true);
  });

  it("leaves out look-alike characters", () => {
    for (const c of "01OILSB25Z8") expect(PICKUP_CODE_ALPHABET).not.toContain(c);
  });
});

describe("normalizePickupCode", () => {
  it("uppercases and strips spaces and dashes", () => {
    expect(normalizePickupCode(" k7r-q x ")).toBe("K7RQX");
  });
});

describe("MAX_PICKUP_ATTEMPTS", () => {
  it("allows a few tries before locking", () => {
    expect(MAX_PICKUP_ATTEMPTS).toBe(5);
  });
});

describe("ageOn", () => {
  const on = new Date("2026-11-29T00:00:00Z");

  it("counts whole years", () => {
    expect(ageOn(new Date("2018-11-29T00:00:00Z"), on)).toBe(8);
    expect(ageOn(new Date("2018-11-30T00:00:00Z"), on)).toBe(7);
  });
});

describe("isLikelyChild", () => {
  const on = new Date("2026-11-29T00:00:00Z");

  it("treats members aged 12 or under as children", () => {
    expect(isLikelyChild({ birthDate: new Date("2016-01-01T00:00:00Z"), householdRole: null }, on)).toBe(true);
    expect(isLikelyChild({ birthDate: new Date("2010-01-01T00:00:00Z"), householdRole: "CHILD" }, on)).toBe(false);
  });

  it("falls back to the household role when the birth date is unknown", () => {
    expect(isLikelyChild({ birthDate: null, householdRole: "CHILD" }, on)).toBe(true);
    expect(isLikelyChild({ birthDate: null, householdRole: "HEAD" }, on)).toBe(false);
  });
});

describe("summarizeCheckIns", () => {
  it("splits members, guests, children, and children still in care", () => {
    const summary = summarizeCheckIns([
      { kind: "ATTENDEE", memberId: "a", checkedOutAt: null },
      { kind: "ATTENDEE", memberId: null, checkedOutAt: null },
      { kind: "CHILD", memberId: "c1", checkedOutAt: null },
      { kind: "CHILD", memberId: "c2", checkedOutAt: new Date() },
    ]);
    expect(summary).toEqual({ total: 4, members: 1, guests: 1, children: 2, childrenInCare: 1 });
  });
});

describe("reportedAttendance", () => {
  it("prefers the usher headcount and falls back to check-ins", () => {
    expect(reportedAttendance(250, 180)).toBe(250);
    expect(reportedAttendance(null, 180)).toBe(180);
  });

  it("never reports fewer than were checked in", () => {
    expect(reportedAttendance(100, 180)).toBe(180);
  });
});

describe("serviceCreateSchema", () => {
  const valid = { branchId: BRANCH, name: "Sunday 9 AM", startsAt: "2026-11-29T01:00:00.000Z" };

  it("accepts a service with an optional headcount", () => {
    expect(serviceCreateSchema.safeParse(valid).success).toBe(true);
    expect(serviceCreateSchema.parse({ ...valid, headcount: "240" }).headcount).toBe(240);
  });

  it("rejects a negative headcount and a bad timestamp", () => {
    expect(serviceCreateSchema.safeParse({ ...valid, headcount: -1 }).success).toBe(false);
    expect(serviceCreateSchema.safeParse({ ...valid, startsAt: "tomorrow" }).success).toBe(false);
  });
});

describe("serviceUpdateSchema", () => {
  it("rejects an empty update and allows clearing the headcount", () => {
    expect(serviceUpdateSchema.safeParse({}).success).toBe(false);
    expect(serviceUpdateSchema.parse({ headcount: null }).headcount).toBeNull();
  });
});

describe("serviceListQuerySchema", () => {
  it("rejects a range that ends before it starts", () => {
    expect(serviceListQuerySchema.safeParse({ from: "2026-12-01T00:00:00Z", to: "2026-11-01T00:00:00Z" }).success).toBe(false);
  });
});

describe("checkInCreateSchema", () => {
  it("checks in a member or a named guest", () => {
    expect(checkInCreateSchema.safeParse({ kind: "ATTENDEE", memberId: MEMBER }).success).toBe(true);
    expect(checkInCreateSchema.safeParse({ kind: "ATTENDEE", guestName: "Rosa Diaz" }).success).toBe(true);
  });

  it("needs exactly one of member or guest for an attendee", () => {
    expect(checkInCreateSchema.safeParse({ kind: "ATTENDEE" }).success).toBe(false);
    expect(checkInCreateSchema.safeParse({ kind: "ATTENDEE", memberId: MEMBER, guestName: "Rosa" }).success).toBe(false);
  });

  it("needs a child member and a guardian for kids check-in", () => {
    expect(checkInCreateSchema.safeParse({ kind: "CHILD", memberId: MEMBER, guardianMemberId: GUARDIAN }).success).toBe(true);
    expect(
      checkInCreateSchema.safeParse({ kind: "CHILD", memberId: MEMBER, guardianName: "Lola Cruz", guardianPhone: "0917 000 0000" }).success,
    ).toBe(true);
    expect(checkInCreateSchema.safeParse({ kind: "CHILD", memberId: MEMBER }).success).toBe(false);
    expect(checkInCreateSchema.safeParse({ kind: "CHILD", guestName: "Kid", guardianMemberId: GUARDIAN }).success).toBe(false);
  });

  it("requires a phone number for a guardian who is not a member", () => {
    expect(checkInCreateSchema.safeParse({ kind: "CHILD", memberId: MEMBER, guardianName: "Lola Cruz" }).success).toBe(false);
  });

  it("does not let a child be their own guardian", () => {
    expect(checkInCreateSchema.safeParse({ kind: "CHILD", memberId: MEMBER, guardianMemberId: MEMBER }).success).toBe(false);
  });
});

describe("checkOutSchema", () => {
  it("accepts a pickup code with the person collecting", () => {
    const parsed = checkOutSchema.parse({ method: "CODE", code: " k7r-qx ", pickedUpByMemberId: GUARDIAN });
    expect(parsed.method === "CODE" && parsed.code).toBe("K7RQX");
  });

  it("needs to know who collected the child", () => {
    expect(checkOutSchema.safeParse({ method: "CODE", code: "K7RQX" }).success).toBe(false);
    expect(checkOutSchema.safeParse({ method: "CODE", code: "K7RQX", pickedUpByName: "Lola Cruz" }).success).toBe(true);
  });

  it("rejects a code of the wrong length", () => {
    expect(checkOutSchema.safeParse({ method: "CODE", code: "K7R", pickedUpByMemberId: GUARDIAN }).success).toBe(false);
  });

  it("requires a reason for an override", () => {
    expect(checkOutSchema.safeParse({ method: "OVERRIDE", pickedUpByMemberId: GUARDIAN }).success).toBe(false);
    expect(
      checkOutSchema.safeParse({ method: "OVERRIDE", reason: "Tag lost; ID checked", pickedUpByMemberId: GUARDIAN }).success,
    ).toBe(true);
  });
});

describe("weekStartKey", () => {
  it("returns the local Sunday that starts the week", () => {
    // Sunday 29 November 2026, 09:00 Manila
    expect(weekStartKey(new Date("2026-11-29T01:00:00Z"))).toBe("2026-11-29");
    // Saturday 5 December 2026, 23:30 Manila
    expect(weekStartKey(new Date("2026-12-05T15:30:00Z"))).toBe("2026-11-29");
  });

  it("uses local time, not UTC, near midnight", () => {
    // Sunday 29 November 2026, 07:00 Manila is still Saturday in UTC
    expect(weekStartKey(new Date("2026-11-28T23:00:00Z"))).toBe("2026-11-29");
  });
});
