import { describe, expect, it } from "vitest";
import { rateTone, scheduleLine, termState } from "@/features/school/format";

describe("school formatting", () => {
  it("describes a weekly schedule", () => {
    expect(scheduleLine(0, "10:30", "12:00")).toBe("Sundays, 10:30 AM to 12:00 PM");
    expect(scheduleLine(3, "18:00", null)).toBe("Wednesdays, 6:00 PM");
    expect(scheduleLine(null, null, null)).toBe("No set schedule");
  });

  it("colors attendance rates", () => {
    expect(rateTone(92)).toBe("good");
    expect(rateTone(75)).toBe("fair");
    expect(rateTone(40)).toBe("low");
    expect(rateTone(null)).toBe("none");
  });

  it("describes where today falls in a term", () => {
    const today = new Date("2026-11-24T05:00:00Z");
    expect(termState("2026-10-18T00:00:00.000Z", "2027-02-07T00:00:00.000Z", today)).toBe("current");
    expect(termState("2027-03-01T00:00:00.000Z", "2027-06-01T00:00:00.000Z", today)).toBe("upcoming");
    expect(termState("2026-01-01T00:00:00.000Z", "2026-05-01T00:00:00.000Z", today)).toBe("ended");
  });
});
