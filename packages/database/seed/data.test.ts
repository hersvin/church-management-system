import * as seedData from "./data";
import { ROLE_KEYS, branchCreateSchema, settingUpsertSchema } from "@cms/shared";
import { describe, expect, it } from "vitest";
import { SAMPLE_BRANCHES, SAMPLE_SETTINGS, SAMPLE_USERS } from "./data";

describe("seed data", () => {
  it("provides valid branches with unique codes including MAIN", () => {
    for (const branch of SAMPLE_BRANCHES) expect(branchCreateSchema.safeParse(branch).success).toBe(true);
    const codes = SAMPLE_BRANCHES.map((b) => b.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toContain("MAIN");
  });

  it("provides at least one sample user for every role besides the seeded admin", () => {
    const roles = new Set(SAMPLE_USERS.map((u) => u.roleKey));
    for (const key of ROLE_KEYS.filter((k) => k !== "ADMIN")) expect(roles).toContain(key);
  });

  it("uses unique emails on a reserved domain", () => {
    const emails = SAMPLE_USERS.map((u) => u.email);
    expect(new Set(emails).size).toBe(emails.length);
    for (const email of emails) expect(email).toMatch(/@cms\.local$/);
  });

  it("assigns branch users to a known branch code", () => {
    const codes = new Set(SAMPLE_BRANCHES.map((b) => b.code));
    for (const user of SAMPLE_USERS) {
      if (user.branchCode !== null) expect(codes).toContain(user.branchCode);
    }
  });

  it("provides valid settings", () => {
    for (const setting of SAMPLE_SETTINGS) {
      expect(settingUpsertSchema.safeParse({ key: setting.key, value: setting.value }).success).toBe(true);
    }
  });
});

describe("sample account links", () => {
  it("links sample accounts to sample members by email, each at most once", async () => {
    const { SAMPLE_ACCOUNT_LINKS, SAMPLE_HOUSEHOLDS, SAMPLE_INDIVIDUALS } = seedData;
    const users = new Set(SAMPLE_USERS.map((u) => u.email));
    const members = new Set(
      [...SAMPLE_HOUSEHOLDS.flatMap((h) => h.members), ...SAMPLE_INDIVIDUALS].map((m) => m.email).filter(Boolean),
    );
    expect(SAMPLE_ACCOUNT_LINKS.length).toBeGreaterThan(0);
    for (const link of SAMPLE_ACCOUNT_LINKS) {
      expect(users.has(link.userEmail), link.userEmail).toBe(true);
      expect(members.has(link.memberEmail), link.memberEmail).toBe(true);
    }
    expect(new Set(SAMPLE_ACCOUNT_LINKS.map((l) => l.memberEmail)).size).toBe(SAMPLE_ACCOUNT_LINKS.length);
  });
});

describe("sample members", () => {
  const BRANCH = "11111111-1111-4111-8111-111111111111";

  it("gives every household exactly one head", async () => {
    const { SAMPLE_HOUSEHOLDS } = seedData;
    for (const household of SAMPLE_HOUSEHOLDS) {
      expect(household.members.filter((m) => m.householdRole === "HEAD")).toHaveLength(1);
    }
  });

  it("places households in known branches", async () => {
    const { SAMPLE_HOUSEHOLDS } = seedData;
    const codes = new Set(SAMPLE_BRANCHES.map((b) => b.code));
    for (const household of SAMPLE_HOUSEHOLDS) expect(codes).toContain(household.branchCode);
  });

  it("provides members that pass the shared create schema", async () => {
    const { SAMPLE_HOUSEHOLDS, SAMPLE_INDIVIDUALS } = seedData;
    const { memberCreateSchema } = await import("@cms/shared");
    const all = [...SAMPLE_HOUSEHOLDS.flatMap((h) => h.members), ...SAMPLE_INDIVIDUALS];
    expect(all.length).toBeGreaterThanOrEqual(20);
    for (const { householdRole: _role, branchCode: _code, ...member } of all as unknown as Record<string, unknown>[]) {
      const result = memberCreateSchema.safeParse({ ...member, branchId: BRANCH });
      expect(result.success, JSON.stringify(member)).toBe(true);
    }
  });

  it("covers every member status", async () => {
    const { SAMPLE_HOUSEHOLDS, SAMPLE_INDIVIDUALS } = seedData;
    const statuses = new Set([...SAMPLE_HOUSEHOLDS.flatMap((h) => h.members), ...SAMPLE_INDIVIDUALS].map((m) => m.status));
    expect([...statuses].sort()).toEqual(["INACTIVE", "MEMBER", "REGULAR", "VISITOR"]);
  });
});

describe("sample ministries", () => {
  const BRANCH = "11111111-1111-4111-8111-111111111111";

  async function load() {
    const data = seedData;
    const people = [
      ...data.SAMPLE_HOUSEHOLDS.flatMap((h) => h.members.map((m) => ({ ...m, branchCode: h.branchCode }))),
      ...data.SAMPLE_INDIVIDUALS,
    ];
    return { ...data, people };
  }

  it("provides ministries that pass the shared create schema", async () => {
    const { SAMPLE_MINISTRIES } = await load();
    const { ministryCreateSchema } = await import("@cms/shared");
    expect(SAMPLE_MINISTRIES.length).toBe(4);
    for (const { roles: _r, roster: _ro, branchCode: _b, ...ministry } of SAMPLE_MINISTRIES) {
      expect(ministryCreateSchema.safeParse({ ...ministry, branchId: BRANCH }).success, ministry.name).toBe(true);
    }
  });

  it("gives every ministry at least one leader", async () => {
    const { SAMPLE_MINISTRIES } = await load();
    for (const ministry of SAMPLE_MINISTRIES) {
      expect(ministry.roster.some((r) => r.position === "LEADER"), ministry.name).toBe(true);
    }
  });

  it("only rosters sample people from the same branch", async () => {
    const { SAMPLE_MINISTRIES, people } = await load();
    for (const ministry of SAMPLE_MINISTRIES) {
      for (const entry of ministry.roster) {
        const person = people.find((p) => `${p.firstName} ${p.lastName}` === entry.person);
        expect(person, entry.person).toBeDefined();
        expect(person!.branchCode, `${entry.person} in ${ministry.name}`).toBe(ministry.branchCode);
      }
    }
  });

  it("only assigns roles the ministry defines", async () => {
    const { SAMPLE_MINISTRIES } = await load();
    for (const ministry of SAMPLE_MINISTRIES) {
      for (const entry of ministry.roster) {
        if (entry.role) expect(ministry.roles).toContain(entry.role);
      }
    }
  });

  it("never lists a person twice in one ministry", async () => {
    const { SAMPLE_MINISTRIES } = await load();
    for (const ministry of SAMPLE_MINISTRIES) {
      const names = ministry.roster.map((r) => r.person);
      expect(new Set(names).size).toBe(names.length);
    }
  });
});

describe("sample rooms and events", () => {
  const BRANCH = "11111111-1111-4111-8111-111111111111";
  // Tuesday 2026-11-24 15:00 in Manila.
  const NOW = new Date("2026-11-24T07:00:00Z");

  it("provides rooms that pass the shared schema with unique names per branch", async () => {
    const { SAMPLE_ROOMS } = seedData;
    const { roomCreateSchema } = await import("@cms/shared");
    for (const { branchCode: _b, ...room } of SAMPLE_ROOMS) {
      expect(roomCreateSchema.safeParse({ ...room, branchId: BRANCH }).success, room.name).toBe(true);
    }
    const keys = SAMPLE_ROOMS.map((r) => `${r.branchCode}:${r.name}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gives every room an hourly rate, with bigger rooms costing more within a branch", () => {
    const { SAMPLE_ROOMS } = seedData;
    for (const room of SAMPLE_ROOMS) expect(room.hourlyRate, room.name).toBeGreaterThan(0);
    for (const code of new Set(SAMPLE_ROOMS.map((r) => r.branchCode))) {
      const rooms = SAMPLE_ROOMS.filter((r) => r.branchCode === code).sort((a, b) => a.capacity - b.capacity);
      const rates = rooms.map((r) => r.hourlyRate);
      expect(rates, code).toEqual([...rates].sort((a, b) => a - b));
    }
  });

  it("anchors the schedule on the next Sunday in Manila", async () => {
    const { nextSundayManila } = seedData;
    expect(nextSundayManila(NOW).toISOString()).toBe("2026-11-28T16:00:00.000Z");
  });

  it("converts Manila wall time to UTC", async () => {
    const { manilaTime, nextSundayManila } = seedData;
    const sunday = nextSundayManila(NOW);
    expect(manilaTime(sunday, 0, "08:00").toISOString()).toBe("2026-11-29T00:00:00.000Z");
    expect(manilaTime(sunday, 4, "19:00").toISOString()).toBe("2026-12-03T11:00:00.000Z");
  });

  it("only uses rooms from the event's branch and known ministries from any branch", async () => {
    const { SAMPLE_EVENTS, SAMPLE_ROOMS, SAMPLE_MINISTRIES } = seedData;
    for (const event of SAMPLE_EVENTS) {
      if (event.room) {
        expect(SAMPLE_ROOMS.find((r) => r.name === event.room && r.branchCode === event.branchCode), event.title).toBeDefined();
      }
      if (event.ministry) {
        expect(
          SAMPLE_MINISTRIES.find((m) => m.name === event.ministry),
          event.title,
        ).toBeDefined();
      }
    }
  });

  it("produces a schedule with no overlapping bookings in any room", async () => {
    const { buildSampleSchedule, nextSundayManila } = seedData;
    const { findOverlaps } = await import("@cms/shared");
    const schedule = buildSampleSchedule(nextSundayManila(NOW));
    const byRoom = new Map<string, { startsAt: Date; endsAt: Date }[]>();
    for (const item of schedule) {
      if (!item.room) continue;
      const key = `${item.branchCode}:${item.room}`;
      byRoom.set(key, [...(byRoom.get(key) ?? []), ...item.occurrences]);
    }
    for (const [room, ranges] of byRoom) {
      for (let i = 0; i < ranges.length; i += 1) {
        const clashes = findOverlaps([ranges[i]], ranges.filter((_, j) => j !== i));
        expect(clashes, room).toHaveLength(0);
      }
    }
    expect(schedule.every((s) => s.occurrences.every((o) => o.startsAt > NOW))).toBe(true);
  });

  it("gives registration events a capacity", async () => {
    const { SAMPLE_EVENTS } = seedData;
    for (const e of SAMPLE_EVENTS.filter((x) => x.registrationRequired)) expect(e.capacity, e.title).toBeGreaterThan(0);
  });
});

describe("sample school", () => {
  const NOW = new Date("2026-11-24T07:00:00Z");
  const people = [
    ...seedData.SAMPLE_HOUSEHOLDS.flatMap((h) => h.members.map((m) => ({ ...m, branchCode: h.branchCode }))),
    ...seedData.SAMPLE_INDIVIDUALS,
  ];
  const find = (name: string, branchCode: string) =>
    people.find((p) => `${p.firstName} ${p.lastName}` === name && p.branchCode === branchCode);

  it("only uses teachers and students from the class's branch", () => {
    for (const c of seedData.SAMPLE_CLASSES) {
      for (const t of c.teachers) expect(find(t.person, c.branchCode), `${t.person} in ${c.name}`).toBeDefined();
      for (const s of c.students) expect(find(s.person, c.branchCode), `${s.person} in ${c.name}`).toBeDefined();
    }
  });

  it("never makes a teacher a student of the same class", () => {
    for (const c of seedData.SAMPLE_CLASSES) {
      const teachers = new Set(c.teachers.map((t) => t.person));
      for (const s of c.students) expect(teachers.has(s.person), `${s.person} in ${c.name}`).toBe(false);
    }
  });

  it("puts each class in a known term and room of its branch", () => {
    for (const c of seedData.SAMPLE_CLASSES) {
      expect(seedData.SAMPLE_TERMS.some((t) => t.branchCode === c.branchCode)).toBe(true);
      if (c.room) expect(seedData.SAMPLE_ROOMS.some((r) => r.name === c.room && r.branchCode === c.branchCode), c.name).toBe(true);
    }
  });

  it("passes the shared class schema", async () => {
    const { classCreateSchema } = await import("@cms/shared");
    for (const c of seedData.SAMPLE_CLASSES) {
      const { teachers: _t, students: _s, branchCode: _b, room: _r, ...fields } = c;
      expect(classCreateSchema.safeParse({ ...fields, termId: "22222222-2222-4222-8222-222222222222" }).success, c.name).toBe(true);
    }
  });

  it("builds term dates around the anchor Sunday", () => {
    const term = seedData.termDates(seedData.nextSundayManila(NOW), seedData.SAMPLE_TERMS[0]);
    expect(term).toEqual({ startsOn: "2026-10-18", endsOn: "2027-02-07" });
  });

  it("creates past sessions only, on the class's meeting day, inside the term", () => {
    const sunday = seedData.nextSundayManila(NOW);
    for (const c of seedData.SAMPLE_CLASSES) {
      const term = seedData.termDates(sunday, seedData.SAMPLE_TERMS.find((t) => t.branchCode === c.branchCode)!);
      const dates = seedData.pastSessionDates(term.startsOn, c.meetingDay!, NOW);
      expect(dates.length, c.name).toBeGreaterThan(0);
      for (const d of dates) {
        expect(d >= term.startsOn && d <= term.endsOn).toBe(true);
        expect(new Date(`${d}T12:00:00Z`).getUTCDay()).toBe(c.meetingDay);
        expect(d < "2026-11-24").toBe(true);
      }
    }
  });

  it("assigns attendance deterministically with mostly present", () => {
    const statuses = Array.from({ length: 50 }, (_, i) => seedData.sampleAttendance(i % 5, Math.floor(i / 5)));
    expect(statuses).toEqual(Array.from({ length: 50 }, (_, i) => seedData.sampleAttendance(i % 5, Math.floor(i / 5))));
    expect(statuses.filter((s) => s === "PRESENT").length).toBeGreaterThan(30);
    expect(new Set(statuses).size).toBe(4);
  });
});

describe("sample attendance", () => {
  const NOW = new Date("2026-11-24T07:00:00Z");
  const sunday = seedData.nextSundayManila(NOW);

  it("puts services in known branches and passes the shared schema", async () => {
    const { serviceCreateSchema } = await import("@cms/shared");
    const codes = new Set<string>(seedData.SAMPLE_BRANCHES.map((b) => b.code));
    for (const s of seedData.SAMPLE_SERVICES) {
      expect(codes.has(s.branchCode), s.name).toBe(true);
      const startsAt = seedData.manilaTime(sunday, 0, s.time);
      expect(serviceCreateSchema.safeParse({ branchId: "11111111-1111-4111-8111-111111111111", name: s.name, startsAt }).success).toBe(true);
    }
  });

  it("gives each service a unique name within its branch", () => {
    const keys = seedData.SAMPLE_SERVICES.map((s) => `${s.branchCode}:${s.name}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("lists past Sundays only, newest first, a week apart", () => {
    const weeks = seedData.pastServiceSundays(sunday, seedData.PAST_SERVICE_WEEKS);
    expect(weeks).toHaveLength(seedData.PAST_SERVICE_WEEKS);
    expect(weeks[0].getTime()).toBe(sunday.getTime() - 7 * 86_400_000);
    for (const w of weeks) expect(w < NOW).toBe(true);
  });

  it("checks people in deterministically, with most attending", () => {
    const marks = Array.from({ length: 80 }, (_, i) => seedData.attendsService(i % 10, Math.floor(i / 10)));
    expect(marks).toEqual(Array.from({ length: 80 }, (_, i) => seedData.attendsService(i % 10, Math.floor(i / 10))));
    const share = marks.filter(Boolean).length / marks.length;
    expect(share).toBeGreaterThan(0.6);
    expect(share).toBeLessThan(1);
  });

  it("reports headcounts above zero that vary week to week", () => {
    const counts = Array.from({ length: 8 }, (_, w) => seedData.sampleHeadcount(seedData.SAMPLE_SERVICES[0], w));
    expect(counts.every((c) => c > 0)).toBe(true);
    expect(new Set(counts).size).toBeGreaterThan(1);
  });

  it("includes young children with a household head to collect them", async () => {
    const { isLikelyChild } = await import("@cms/shared");
    const kids = seedData.SAMPLE_HOUSEHOLDS.flatMap((h) =>
      h.members
        .filter((m) => isLikelyChild({ birthDate: m.birthDate ? new Date(`${m.birthDate}T00:00:00Z`) : null, householdRole: m.householdRole ?? null }, NOW))
        .map(() => h),
    );
    expect(kids.length).toBeGreaterThanOrEqual(3);
    for (const h of kids) expect(h.members.some((m) => m.householdRole === "HEAD"), h.name).toBe(true);
  });
});

describe("ministries and staff", () => {
  it("has exactly the four church ministries, with positions left empty for now", () => {
    const { SAMPLE_MINISTRIES } = seedData;
    expect(SAMPLE_MINISTRIES.map((m) => m.name).sort()).toEqual(["Dance", "Multimedia", "Usher", "Worship"]);
    for (const ministry of SAMPLE_MINISTRIES) {
      expect(ministry.roles).toEqual([]);
      for (const entry of ministry.roster) expect(entry.role).toBeUndefined();
    }
  });

  it("links every active staff account to a member who serves in a ministry", () => {
    const { SAMPLE_ACCOUNT_LINKS, SAMPLE_HOUSEHOLDS, SAMPLE_INDIVIDUALS, SAMPLE_MINISTRIES } = seedData;
    const people = [...SAMPLE_HOUSEHOLDS.flatMap((h) => h.members), ...SAMPLE_INDIVIDUALS];
    const serving = new Set(SAMPLE_MINISTRIES.flatMap((m) => m.roster.map((r) => r.person)));
    const staff = SAMPLE_USERS.filter((u) => u.roleKey === "STAFF" && u.isActive);
    expect(staff.length).toBeGreaterThanOrEqual(4);
    for (const user of staff) {
      const link = SAMPLE_ACCOUNT_LINKS.find((l) => l.userEmail === user.email);
      expect(link, user.email).toBeDefined();
      const person = people.find((p) => p.email === link!.memberEmail)!;
      expect(serving.has(`${person.firstName} ${person.lastName}`), user.email).toBe(true);
    }
  });

  it("puts at least one staff account in the Usher ministry", () => {
    const { SAMPLE_MINISTRIES } = seedData;
    expect(SAMPLE_MINISTRIES.find((m) => m.name === "Usher")!.roster.length).toBeGreaterThan(0);
  });

  it("gives admins and pastors every branch", () => {
    for (const user of SAMPLE_USERS.filter((u) => u.roleKey !== "STAFF")) expect(user.branchCode, user.email).toBeNull();
  });

  it("only tags events with current ministries", () => {
    const { SAMPLE_EVENTS, SAMPLE_MINISTRIES } = seedData;
    const names = new Set(SAMPLE_MINISTRIES.map((m) => m.name));
    for (const event of SAMPLE_EVENTS) if (event.ministry) expect(names, event.title).toContain(event.ministry);
  });
});
