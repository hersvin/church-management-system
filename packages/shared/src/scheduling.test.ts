import { describe, expect, it } from "vitest";
import { expandOccurrences, findOverlaps, overlaps, MAX_OCCURRENCES } from "./scheduling";

const at = (iso: string) => new Date(iso);

describe("overlaps", () => {
  const a = { startsAt: at("2026-12-06T09:00:00Z"), endsAt: at("2026-12-06T11:00:00Z") };

  it("detects partial and full overlap", () => {
    expect(overlaps(a, { startsAt: at("2026-12-06T10:00:00Z"), endsAt: at("2026-12-06T12:00:00Z") })).toBe(true);
    expect(overlaps(a, { startsAt: at("2026-12-06T08:00:00Z"), endsAt: at("2026-12-06T13:00:00Z") })).toBe(true);
  });

  it("treats back-to-back ranges as free", () => {
    expect(overlaps(a, { startsAt: at("2026-12-06T11:00:00Z"), endsAt: at("2026-12-06T12:00:00Z") })).toBe(false);
    expect(overlaps(a, { startsAt: at("2026-12-06T07:00:00Z"), endsAt: at("2026-12-06T09:00:00Z") })).toBe(false);
  });
});

describe("findOverlaps", () => {
  it("returns each candidate paired with the existing ranges it hits", () => {
    const candidates = [
      { startsAt: at("2026-12-06T09:00:00Z"), endsAt: at("2026-12-06T10:00:00Z") },
      { startsAt: at("2026-12-13T09:00:00Z"), endsAt: at("2026-12-13T10:00:00Z") },
    ];
    const existing = [{ id: "b1", startsAt: at("2026-12-13T09:30:00Z"), endsAt: at("2026-12-13T11:00:00Z") }];
    const result = findOverlaps(candidates, existing);
    expect(result).toHaveLength(1);
    expect(result[0].candidate.startsAt.toISOString()).toBe("2026-12-13T09:00:00.000Z");
    expect(result[0].conflicts.map((c) => c.id)).toEqual(["b1"]);
  });
});

describe("expandOccurrences", () => {
  const start = at("2026-12-06T09:00:00Z");
  const end = at("2026-12-06T10:30:00Z");

  it("returns a single occurrence without repeat", () => {
    expect(expandOccurrences(start, end)).toEqual([{ startsAt: start, endsAt: end }]);
  });

  it("repeats weekly up to and including the until date, keeping duration", () => {
    const result = expandOccurrences(start, end, { frequency: "WEEKLY", until: at("2026-12-27T23:59:00Z") });
    expect(result.map((o) => o.startsAt.toISOString())).toEqual([
      "2026-12-06T09:00:00.000Z",
      "2026-12-13T09:00:00.000Z",
      "2026-12-20T09:00:00.000Z",
      "2026-12-27T09:00:00.000Z",
    ]);
    for (const o of result) expect(o.endsAt.getTime() - o.startsAt.getTime()).toBe(90 * 60 * 1000);
  });

  it("repeats every two weeks", () => {
    const result = expandOccurrences(start, end, { frequency: "BIWEEKLY", until: at("2027-01-03T00:00:00Z") });
    expect(result.map((o) => o.startsAt.toISOString().slice(0, 10))).toEqual(["2026-12-06", "2026-12-20", "2027-01-03"]);
  });

  it("repeats monthly on the same day and skips months without that day", () => {
    const result = expandOccurrences(at("2027-01-31T18:00:00Z"), at("2027-01-31T19:00:00Z"), {
      frequency: "MONTHLY",
      until: at("2027-05-31T23:00:00Z"),
    });
    expect(result.map((o) => o.startsAt.toISOString().slice(0, 10))).toEqual(["2027-01-31", "2027-03-31", "2027-05-31"]);
  });

  it("caps the number of occurrences", () => {
    const result = expandOccurrences(start, end, { frequency: "WEEKLY", until: at("2030-01-01T00:00:00Z") });
    expect(result).toHaveLength(MAX_OCCURRENCES);
  });
});
