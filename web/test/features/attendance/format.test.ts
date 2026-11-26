import { describe, expect, it } from "vitest";
import { barPercents, checkInName, filterCheckIns, formatPickupCode, serviceTiming } from "@/features/attendance/format";

const row = (over: Partial<Parameters<typeof checkInName>[0]> & { kind?: "ATTENDEE" | "CHILD"; checkedOutAt?: string | null }) => ({
  kind: "ATTENDEE" as const,
  member: null,
  guestName: null,
  checkedOutAt: null,
  ...over,
});

describe("formatPickupCode", () => {
  it("splits the code so it reads aloud easily", () => {
    expect(formatPickupCode("K7RQX")).toBe("K7R-QX");
  });
});

describe("checkInName", () => {
  it("prefers the member name and falls back to the guest name", () => {
    expect(checkInName(row({ member: { id: "m", firstName: "Ana", lastName: "Cruz" } }))).toBe("Ana Cruz");
    expect(checkInName(row({ guestName: "Rosa Diaz" }))).toBe("Rosa Diaz");
  });
});

describe("filterCheckIns", () => {
  const items = [
    row({ member: { id: "a", firstName: "Ana", lastName: "Cruz" } }),
    row({ guestName: "Rosa Diaz" }),
    row({ kind: "CHILD", member: { id: "c", firstName: "Ada", lastName: "Okafor" } }),
    row({ kind: "CHILD", member: { id: "d", firstName: "Miguel", lastName: "Santos" }, checkedOutAt: "2026-11-29T03:00:00Z" }),
  ];
  const names = (list: typeof items) => list.map(checkInName);

  it("filters by group", () => {
    expect(names(filterCheckIns(items, "kids", ""))).toEqual(["Ada Okafor", "Miguel Santos"]);
    expect(names(filterCheckIns(items, "in-care", ""))).toEqual(["Ada Okafor"]);
    expect(names(filterCheckIns(items, "guests", ""))).toEqual(["Rosa Diaz"]);
    expect(filterCheckIns(items, "all", "")).toHaveLength(4);
  });

  it("searches names without caring about case", () => {
    expect(names(filterCheckIns(items, "all", "  sant"))).toEqual(["Miguel Santos"]);
  });
});

describe("serviceTiming", () => {
  const now = new Date("2026-11-29T02:00:00Z"); // Sunday 10:00 Manila

  it("tells past, today, and upcoming apart by local day", () => {
    expect(serviceTiming("2026-11-29T01:00:00Z", now)).toBe("today");
    expect(serviceTiming("2026-11-28T16:30:00Z", now)).toBe("today"); // Saturday in UTC, already Sunday 00:30 in Manila
    expect(serviceTiming("2026-11-28T15:30:00Z", now)).toBe("past"); // Saturday 23:30 in Manila
    expect(serviceTiming("2026-11-22T01:00:00Z", now)).toBe("past");
    expect(serviceTiming("2026-12-06T01:00:00Z", now)).toBe("upcoming");
  });
});

describe("barPercents", () => {
  it("scales values against the largest one", () => {
    expect(barPercents([50, 100, 0])).toEqual([50, 100, 0]);
  });

  it("returns zeros when everything is zero", () => {
    expect(barPercents([0, 0])).toEqual([0, 0]);
  });
});
