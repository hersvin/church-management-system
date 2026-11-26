import { describe, expect, it } from "vitest";
import { formatReportValue, readReportParams, reportHref, roomUsageToday } from "@/features/reports/format";

describe("formatReportValue", () => {
  it("shows a dash for empty values", () => {
    expect(formatReportValue(null, "number")).toBe("--");
    expect(formatReportValue(null, "percent")).toBe("--");
  });

  it("formats numbers, percents, and pesos", () => {
    expect(formatReportValue(12345, "number")).toBe("12,345");
    expect(formatReportValue(37.5, "percent")).toBe("37.5%");
    expect(formatReportValue(27000, "money")).toBe("₱27,000");
    expect(formatReportValue(350.5, "money")).toBe("₱350.50");
  });

  it("leaves text and dates as they are", () => {
    expect(formatReportValue("Worship", "text")).toBe("Worship");
    expect(formatReportValue("2026-11-22 09:00", "date")).toBe("2026-11-22 09:00");
  });
});

describe("readReportParams and reportHref", () => {
  it("reads a known kind and filters from the URL", () => {
    const params = new URLSearchParams("kind=rooms&from=2026-11-01&to=2026-11-30&branchId=b1&junk=1");
    expect(readReportParams(params)).toEqual({ kind: "rooms", query: { from: "2026-11-01", to: "2026-11-30", branchId: "b1" } });
  });

  it("falls back to attendance with no filters", () => {
    expect(readReportParams(new URLSearchParams("kind=giving&from="))).toEqual({ kind: "attendance", query: {} });
  });

  it("builds a shareable link, dropping empty filters", () => {
    expect(reportHref("events", { from: "2026-11-01", to: "", branchId: undefined })).toBe("/reports?kind=events&from=2026-11-01");
  });
});

describe("roomUsageToday", () => {
  const now = new Date("2026-11-25T02:00:00Z");
  const room = (name: string, bookings: { startsAt: string; endsAt: string }[]) => ({
    id: name,
    name,
    bookings: bookings.map((b, i) => ({ id: `${name}${i}`, purpose: "Use", ...b })),
  });

  it("lists rooms with bookings today, in use first, and marks each booking's state", () => {
    const usage = roomUsageToday(
      [
        room("Empty", []),
        room("Hall", [{ startsAt: "2026-11-25T05:00:00Z", endsAt: "2026-11-25T06:00:00Z" }]),
        room("Sanctuary", [
          { startsAt: "2026-11-25T00:00:00Z", endsAt: "2026-11-25T01:00:00Z" },
          { startsAt: "2026-11-25T01:30:00Z", endsAt: "2026-11-25T03:00:00Z" },
        ]),
      ],
      now,
    );
    expect(usage.map((u) => [u.name, u.inUse])).toEqual([
      ["Sanctuary", true],
      ["Hall", false],
    ]);
    expect(usage[0].bookings.map((b) => b.state)).toEqual(["done", "active"]);
    expect(usage[1].bookings[0].state).toBe("waiting");
  });
});
