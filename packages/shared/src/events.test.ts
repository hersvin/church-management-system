import { describe, expect, it } from "vitest";
import {
  bookingCreateSchema,
  bookingDecisionSchema,
  calendarRangeSchema,
  eventCreateSchema,
  eventUpdateSchema,
  registrationCreateSchema,
  roomCreateSchema,
  roomUpdateSchema,
} from "./index";

const BRANCH = "11111111-1111-4111-8111-111111111111";
const ROOM = "22222222-2222-4222-8222-222222222222";
const MEMBER = "33333333-3333-4333-8333-333333333333";

describe("roomCreateSchema", () => {
  it("accepts a room and normalizes features", () => {
    const room = roomCreateSchema.parse({ name: "Sanctuary", branchId: BRANCH, capacity: "300", features: [" Projector ", "projector", "Piano"] });
    expect(room.capacity).toBe(300);
    expect(room.features).toEqual(["Projector", "Piano"]);
  });

  it("takes an hourly rate in pesos with at most two decimals", () => {
    expect(roomCreateSchema.parse({ name: "Hall", branchId: BRANCH, hourlyRate: "1500" }).hourlyRate).toBe(1500);
    expect(roomCreateSchema.parse({ name: "Hall", branchId: BRANCH, hourlyRate: 0 }).hourlyRate).toBe(0);
    expect(roomCreateSchema.parse({ name: "Hall", branchId: BRANCH, hourlyRate: "" }).hourlyRate).toBeUndefined();
    expect(roomCreateSchema.safeParse({ name: "Hall", branchId: BRANCH, hourlyRate: -1 }).success).toBe(false);
    expect(roomCreateSchema.safeParse({ name: "Hall", branchId: BRANCH, hourlyRate: 12.345 }).success).toBe(false);
  });

  it("rejects a non-positive capacity", () => {
    expect(roomCreateSchema.safeParse({ name: "X", branchId: BRANCH, capacity: 0 }).success).toBe(false);
  });
});

describe("roomUpdateSchema", () => {
  it("lets blank text clear the location and null clear capacity", () => {
    expect(roomUpdateSchema.parse({ location: "", capacity: null })).toEqual({ location: null, capacity: null });
  });

  it("lets a blank or null rate clear the hourly rate", () => {
    expect(roomUpdateSchema.parse({ hourlyRate: "" })).toEqual({ hourlyRate: null });
    expect(roomUpdateSchema.parse({ hourlyRate: "750.50" })).toEqual({ hourlyRate: 750.5 });
  });
});

describe("bookingCreateSchema", () => {
  const valid = { roomId: ROOM, startsAt: "2026-12-06T09:00:00Z", endsAt: "2026-12-06T10:00:00Z", purpose: "Choir practice" };

  it("coerces dates", () => {
    const b = bookingCreateSchema.parse(valid);
    expect(b.startsAt).toBeInstanceOf(Date);
  });

  it("requires the end after the start", () => {
    expect(bookingCreateSchema.safeParse({ ...valid, endsAt: valid.startsAt }).success).toBe(false);
  });

  it("limits a booking to 24 hours", () => {
    expect(bookingCreateSchema.safeParse({ ...valid, endsAt: "2026-12-08T10:00:00Z" }).success).toBe(false);
  });
});

describe("bookingDecisionSchema", () => {
  it("accepts an optional note", () => {
    expect(bookingDecisionSchema.parse({})).toEqual({});
    expect(bookingDecisionSchema.parse({ note: " ok " })).toEqual({ note: "ok" });
  });
});

describe("eventCreateSchema", () => {
  const valid = {
    title: "Sunday Worship",
    category: "SERVICE",
    startsAt: "2026-12-06T09:00:00Z",
    endsAt: "2026-12-06T10:30:00Z",
    branchId: BRANCH,
  };

  it("applies defaults", () => {
    const e = eventCreateSchema.parse(valid);
    expect(e.registrationRequired).toBe(false);
    expect(e.repeat).toBeUndefined();
  });

  it("requires the end after the start", () => {
    expect(eventCreateSchema.safeParse({ ...valid, endsAt: "2026-12-06T08:00:00Z" }).success).toBe(false);
  });

  it("requires repeat until to be after the start", () => {
    expect(eventCreateSchema.safeParse({ ...valid, repeat: { frequency: "WEEKLY", until: "2026-12-01" } }).success).toBe(false);
    expect(eventCreateSchema.safeParse({ ...valid, repeat: { frequency: "WEEKLY", until: "2027-01-31" } }).success).toBe(true);
  });

  it("requires a capacity when registration is limited", () => {
    expect(eventCreateSchema.safeParse({ ...valid, capacity: 50, registrationRequired: true }).success).toBe(true);
  });
});

describe("eventUpdateSchema", () => {
  it("allows clearing the room", () => {
    expect(eventUpdateSchema.parse({ roomId: null })).toEqual({ roomId: null });
  });

  it("rejects an end before the start when both are given", () => {
    expect(
      eventUpdateSchema.safeParse({ startsAt: "2026-12-06T10:00:00Z", endsAt: "2026-12-06T09:00:00Z" }).success,
    ).toBe(false);
  });
});

describe("calendarRangeSchema", () => {
  it("requires from before to and caps the window", () => {
    expect(calendarRangeSchema.safeParse({ from: "2026-12-01", to: "2027-01-01" }).success).toBe(true);
    expect(calendarRangeSchema.safeParse({ from: "2026-12-01", to: "2026-11-01" }).success).toBe(false);
    expect(calendarRangeSchema.safeParse({ from: "2026-01-01", to: "2027-06-01" }).success).toBe(false);
  });
});

describe("registrationCreateSchema", () => {
  it("accepts a member", () => {
    expect(registrationCreateSchema.safeParse({ memberId: MEMBER }).success).toBe(true);
  });

  it("accepts a guest with a name", () => {
    expect(registrationCreateSchema.safeParse({ guestName: "Jo Smith", guestEmail: "jo@example.org" }).success).toBe(true);
  });

  it("requires either a member or a guest name", () => {
    expect(registrationCreateSchema.safeParse({}).success).toBe(false);
    expect(registrationCreateSchema.safeParse({ memberId: MEMBER, guestName: "Jo" }).success).toBe(false);
  });
});
