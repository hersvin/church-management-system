import { describe, expect, it } from "vitest";
import {
  buildAttendanceReport,
  buildEventReport,
  buildMembershipReport,
  buildMinistryReport,
  buildRoomReport,
  localDateTime,
  reportQuerySchema,
  reportRange,
  toCsv,
  type ReportColumn,
} from "./reports";

// 2026-11-25 10:00 in Manila.
const NOW = new Date("2026-11-25T02:00:00Z");
const BRANCH = "11111111-1111-4111-8111-111111111111";
const local = (s: string) => new Date(`${s}+08:00`);

describe("reportQuerySchema", () => {
  it("accepts an empty query", () => {
    expect(reportQuerySchema.parse({})).toEqual({});
  });

  it("accepts dates and a branch", () => {
    expect(reportQuerySchema.parse({ from: "2026-09-01", to: "2026-11-25", branchId: BRANCH })).toEqual({
      from: "2026-09-01",
      to: "2026-11-25",
      branchId: BRANCH,
    });
  });

  it("rejects malformed dates", () => {
    expect(reportQuerySchema.safeParse({ from: "2026-13-01" }).success).toBe(false);
    expect(reportQuerySchema.safeParse({ to: "yesterday" }).success).toBe(false);
  });

  it("rejects 'to' before 'from'", () => {
    expect(reportQuerySchema.safeParse({ from: "2026-11-25", to: "2026-11-24" }).success).toBe(false);
  });

  it("rejects ranges longer than 366 days", () => {
    expect(reportQuerySchema.safeParse({ from: "2025-01-01", to: "2026-01-02" }).success).toBe(false);
    expect(reportQuerySchema.safeParse({ from: "2025-01-01", to: "2026-01-01" }).success).toBe(true);
  });

  it("rejects a non-uuid branch", () => {
    expect(reportQuerySchema.safeParse({ branchId: "main" }).success).toBe(false);
  });
});

describe("reportRange", () => {
  it("defaults to the 12 weeks ending today in church time", () => {
    const r = reportRange({}, NOW);
    expect(r.to).toBe("2026-11-25");
    expect(r.from).toBe("2026-09-03");
    expect(r.days).toBe(84);
  });

  it("uses church local midnights, with an exclusive end", () => {
    const r = reportRange({ from: "2026-11-01", to: "2026-11-30" }, NOW);
    expect(r.start.toISOString()).toBe("2026-10-31T16:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-11-30T16:00:00.000Z");
    expect(r.days).toBe(30);
  });

  it("uses today in church time even when UTC is still yesterday", () => {
    expect(reportRange({}, new Date("2026-11-24T17:00:00Z")).to).toBe("2026-11-25");
  });

  it("throws a RangeError when a single date makes the range invalid", () => {
    expect(() => reportRange({ from: "2026-12-01" }, NOW)).toThrow(RangeError);
    expect(() => reportRange({ from: "2024-01-01" }, NOW)).toThrow(RangeError);
  });
});

describe("localDateTime", () => {
  it("formats in church time", () => {
    expect(localDateTime(new Date("2026-11-22T01:00:00Z"))).toBe("2026-11-22 09:00");
  });
});

describe("buildAttendanceReport", () => {
  it("orders services by time and totals them", () => {
    const report = buildAttendanceReport([
      { startsAt: local("2026-11-22T11:00:00"), name: "11 AM", branch: "Main", headcount: 50, checkIns: 60, children: 4 },
      { startsAt: local("2026-11-22T09:00:00"), name: "9 AM", branch: "Main", headcount: 120, checkIns: 30, children: 10 },
    ]);
    expect(report.rows.map((r) => r.service)).toEqual(["9 AM", "11 AM"]);
    expect(report.rows[0]).toEqual({
      date: "2026-11-22 09:00",
      service: "9 AM",
      branch: "Main",
      headcount: 120,
      checkIns: 30,
      children: 10,
      attendance: 120,
    });
    expect(report.rows[1].attendance).toBe(60);
    expect(report.summary).toEqual([
      { label: "Services", value: 2, kind: "number" },
      { label: "Total attendance", value: 180, kind: "number" },
      { label: "Average", value: 90, kind: "number" },
      { label: "Peak", value: 120, kind: "number" },
      { label: "Check-ins", value: 90, kind: "number" },
      { label: "Children", value: 14, kind: "number" },
    ]);
  });

  it("gives an empty report with zero totals", () => {
    const report = buildAttendanceReport([]);
    expect(report.rows).toEqual([]);
    expect(report.summary.map((s) => s.value)).toEqual([0, 0, 0, 0, 0, 0]);
  });
});

describe("buildMembershipReport", () => {
  const range = reportRange({ from: "2026-10-15", to: "2026-11-25" }, NOW);

  it("buckets new people, members, and baptisms by church month inside the range", () => {
    const report = buildMembershipReport(range, {
      people: [
        { createdAt: local("2026-10-20T10:00:00"), membershipDate: null, baptismDate: null },
        // 2026-11-01 00:30 in Manila is still October in UTC.
        { createdAt: new Date("2026-10-31T16:30:00Z"), membershipDate: new Date("2026-11-08T00:00:00Z"), baptismDate: new Date("2026-11-08T00:00:00Z") },
        // Before the range: only the membership date counts.
        { createdAt: local("2026-01-10T10:00:00"), membershipDate: new Date("2026-10-18T00:00:00Z"), baptismDate: new Date("2026-10-01T00:00:00Z") },
      ],
      statusTotals: { VISITOR: 5, REGULAR: 4, MEMBER: 20, INACTIVE: 1 },
    });
    expect(report.rows).toEqual([
      { month: "2026-10", newPeople: 1, newMembers: 1, baptisms: 0 },
      { month: "2026-11", newPeople: 1, newMembers: 1, baptisms: 1 },
    ]);
    expect(report.summary).toEqual([
      { label: "New people", value: 2, kind: "number" },
      { label: "New members", value: 2, kind: "number" },
      { label: "Baptisms", value: 1, kind: "number" },
      { label: "Visitors now", value: 5, kind: "number" },
      { label: "Regulars now", value: 4, kind: "number" },
      { label: "Members now", value: 20, kind: "number" },
      { label: "Inactive now", value: 1, kind: "number" },
    ]);
  });

  it("lists every month of the range even when empty", () => {
    const report = buildMembershipReport(reportRange({ from: "2026-01-31", to: "2026-04-01" }, NOW), {
      people: [],
      statusTotals: { VISITOR: 0, REGULAR: 0, MEMBER: 0, INACTIVE: 0 },
    });
    expect(report.rows.map((r) => r.month)).toEqual(["2026-01", "2026-02", "2026-03", "2026-04"]);
  });
});

describe("buildMinistryReport", () => {
  const range = reportRange({ from: "2026-11-01", to: "2026-11-30" }, NOW);
  const ministries = [
    { id: "w", name: "Worship", category: "WORSHIP", branch: "Main" },
    { id: "u", name: "Ushers", category: "HOSPITALITY", branch: "Main" },
  ];

  it("counts active, leaders, joined, and left per ministry, and unique people serving", () => {
    const report = buildMinistryReport(range, {
      ministries,
      roster: [
        { ministryId: "w", memberId: "a", position: "LEADER", joinedAt: local("2025-01-01T00:00:00"), leftAt: null },
        { ministryId: "w", memberId: "b", position: "MEMBER", joinedAt: local("2026-11-10T00:00:00"), leftAt: null },
        { ministryId: "w", memberId: "c", position: "MEMBER", joinedAt: local("2025-01-01T00:00:00"), leftAt: local("2026-11-15T00:00:00") },
        { ministryId: "u", memberId: "a", position: "COLEADER", joinedAt: local("2025-01-01T00:00:00"), leftAt: null },
        // Joins after the range: not active, not joined.
        { ministryId: "u", memberId: "d", position: "MEMBER", joinedAt: local("2026-12-02T00:00:00"), leftAt: null },
      ],
      activePeople: 8,
    });
    expect(report.rows).toEqual([
      { ministry: "Ushers", category: "HOSPITALITY", branch: "Main", active: 1, leaders: 1, joined: 0, left: 0 },
      { ministry: "Worship", category: "WORSHIP", branch: "Main", active: 2, leaders: 1, joined: 1, left: 1 },
    ]);
    expect(report.summary).toEqual([
      { label: "Ministries", value: 2, kind: "number" },
      { label: "People serving", value: 2, kind: "number" },
      { label: "Share of people serving", value: 25, kind: "percent" },
    ]);
  });

  it("gives a null share when there are no active people", () => {
    const report = buildMinistryReport(range, { ministries: [], roster: [], activePeople: 0 });
    expect(report.summary[2].value).toBeNull();
  });
});

describe("buildEventReport", () => {
  it("computes turnout and fill, null when there is nothing to divide by", () => {
    const report = buildEventReport([
      { startsAt: local("2026-11-20T18:00:00"), title: "Food Drive", category: "OUTREACH", status: "SCHEDULED", branch: "Main", capacity: 40, registered: 20, checkedIn: 15 },
      { startsAt: local("2026-11-10T18:00:00"), title: "Prayer Night", category: "MEETING", status: "SCHEDULED", branch: "Main", capacity: null, registered: 0, checkedIn: 7 },
      { startsAt: local("2026-11-12T18:00:00"), title: "Picnic", category: "FELLOWSHIP", status: "CANCELLED", branch: "North", capacity: 30, registered: 3, checkedIn: 0 },
    ]);
    expect(report.rows.map((r) => r.event)).toEqual(["Prayer Night", "Picnic", "Food Drive"]);
    expect(report.rows[2]).toEqual({
      date: "2026-11-20 18:00",
      event: "Food Drive",
      category: "OUTREACH",
      branch: "Main",
      status: "SCHEDULED",
      capacity: 40,
      registered: 20,
      checkedIn: 15,
      turnout: 75,
      fill: 50,
    });
    expect(report.rows[0]).toMatchObject({ capacity: null, turnout: null, fill: null });
    expect(report.rows[1]).toMatchObject({ turnout: 0, fill: 10 });
    expect(report.summary).toEqual([
      { label: "Events", value: 3, kind: "number" },
      { label: "Registrations", value: 23, kind: "number" },
      { label: "Check-ins", value: 22, kind: "number" },
      { label: "Average turnout", value: 37.5, kind: "percent" },
    ]);
  });

  it("rounds percents to one decimal", () => {
    const report = buildEventReport([
      { startsAt: NOW, title: "A", category: "OTHER", status: "SCHEDULED", branch: "Main", capacity: 3, registered: 3, checkedIn: 1 },
    ]);
    expect(report.rows[0].turnout).toBe(33.3);
  });
});

describe("buildRoomReport", () => {
  const range = reportRange({ from: "2026-11-01", to: "2026-11-02" }, NOW); // 2 days = 28 open hours

  it("clips bookings to the range and values hours at the hourly rate", () => {
    const report = buildRoomReport(range, {
      rooms: [
        { id: "s", name: "Sanctuary", branch: "Main", capacity: 300, hourlyRate: 6000 },
        { id: "p", name: "Prayer Room", branch: "Main", capacity: 10, hourlyRate: null },
      ],
      bookings: [
        { roomId: "s", startsAt: local("2026-11-01T09:00:00"), endsAt: local("2026-11-01T12:30:00") },
        // Starts before the range: only 1 hour inside.
        { roomId: "s", startsAt: local("2026-10-31T23:00:00"), endsAt: local("2026-11-01T01:00:00") },
        // Fully outside the range.
        { roomId: "s", startsAt: local("2026-11-05T09:00:00"), endsAt: local("2026-11-05T10:00:00") },
        { roomId: "p", startsAt: local("2026-11-02T19:00:00"), endsAt: local("2026-11-02T21:20:00") },
      ],
    });
    expect(report.rows).toEqual([
      { room: "Prayer Room", branch: "Main", capacity: 10, bookings: 1, hours: 2.33, utilization: 8.3, hourlyRate: null, value: null },
      { room: "Sanctuary", branch: "Main", capacity: 300, bookings: 2, hours: 4.5, utilization: 16.1, hourlyRate: 6000, value: 27000 },
    ]);
    expect(report.summary).toEqual([
      { label: "Rooms", value: 2, kind: "number" },
      { label: "Booked hours", value: 6.83, kind: "number" },
      { label: "Average utilization", value: 12.2, kind: "percent" },
      { label: "Estimated value", value: 27000, kind: "money" },
    ]);
  });

  it("gives a null average with no rooms", () => {
    const report = buildRoomReport(range, { rooms: [], bookings: [] });
    expect(report.summary[2].value).toBeNull();
    expect(report.summary[3].value).toBe(0);
  });
});

describe("toCsv", () => {
  const columns: ReportColumn[] = [
    { key: "name", label: "Name", kind: "text" },
    { key: "count", label: "Count", kind: "number" },
  ];

  it("writes a header row and CRLF-separated rows", () => {
    expect(toCsv(columns, [{ name: "Worship", count: 3 }, { name: "Ushers", count: null }])).toBe(
      "Name,Count\r\nWorship,3\r\nUshers,\r\n",
    );
  });

  it("quotes commas, quotes, and line breaks", () => {
    expect(toCsv(columns, [{ name: 'Kids, "Little" Ones\nNorth', count: 1 }])).toBe(
      'Name,Count\r\n"Kids, ""Little"" Ones\nNorth",1\r\n',
    );
  });

  it("neutralizes spreadsheet formulas in text cells", () => {
    const rows = ["=SUM(A1)", "+1", "-2", "@cmd", "\tx", "\rx"].map((name) => ({ name, count: 0 }));
    const lines = toCsv(columns, rows).split("\r\n").slice(1, -1);
    expect(lines).toEqual(["'=SUM(A1),0", "'+1,0", "'-2,0", "'@cmd,0", "'\tx,0", "\"'\rx\",0"]);
  });

  it("keeps negative numbers as numbers", () => {
    expect(toCsv(columns, [{ name: "a", count: -5 }])).toBe("Name,Count\r\na,-5\r\n");
  });
});
