import { z } from "zod";
import { CHURCH_UTC_OFFSET_MINUTES, reportedAttendance } from "./attendance";
import type { MemberStatus } from "./members";

// ---------- Query and range ----------

export const REPORT_KINDS = ["attendance", "membership", "ministries", "events", "rooms"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];
export const reportKindSchema = z.enum(REPORT_KINDS);

export const MAX_REPORT_DAYS = 366;
export const DEFAULT_REPORT_WEEKS = 12;
/** Bookable hours per day (7:00 to 21:00) used for room utilization. */
export const OPEN_HOURS_PER_DAY = 14;

const DAY_MS = 24 * 60 * 60 * 1000;
const OFFSET_MS = CHURCH_UTC_OFFSET_MINUTES * 60 * 1000;

const dayNumber = (key: string) => Date.parse(`${key}T00:00:00Z`) / DAY_MS;
const keyOf = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);
const spanDays = (from: string, to: string) => dayNumber(to) - dayNumber(from) + 1;

export const reportQuerySchema = z
  .object({
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    branchId: z.uuid().optional(),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, { message: "'to' must not be before 'from'", path: ["to"] })
  .refine((q) => !q.from || !q.to || spanDays(q.from, q.to) <= MAX_REPORT_DAYS, {
    message: `A report covers at most ${MAX_REPORT_DAYS} days`,
    path: ["from"],
  });
export type ReportQuery = z.infer<typeof reportQuerySchema>;

export interface ReportRange {
  /** First local day, YYYY-MM-DD. */
  from: string;
  /** Last local day, YYYY-MM-DD. */
  to: string;
  /** Local midnight that starts `from`. */
  start: Date;
  /** Local midnight after `to` (exclusive). */
  end: Date;
  days: number;
}

/** Church local date (YYYY-MM-DD) of an instant. */
export const localDateKey = (date: Date) => new Date(date.getTime() + OFFSET_MS).toISOString().slice(0, 10);

/** Church local "YYYY-MM-DD HH:mm" of an instant. */
export const localDateTime = (date: Date) => new Date(date.getTime() + OFFSET_MS).toISOString().slice(0, 16).replace("T", " ");

const localMidnight = (key: string) => new Date(dayNumber(key) * DAY_MS - OFFSET_MS);

/** Fills the default range and turns local dates into instants. Throws RangeError for an invalid range. */
export function reportRange(query: Pick<ReportQuery, "from" | "to">, now: Date): ReportRange {
  const to = query.to ?? localDateKey(now);
  const from = query.from ?? keyOf(dayNumber(to) - (DEFAULT_REPORT_WEEKS * 7 - 1));
  const days = spanDays(from, to);
  if (days < 1) throw new RangeError("'to' must not be before 'from'");
  if (days > MAX_REPORT_DAYS) throw new RangeError(`A report covers at most ${MAX_REPORT_DAYS} days`);
  return { from, to, start: localMidnight(from), end: localMidnight(keyOf(dayNumber(to) + 1)), days };
}

// ---------- Report shape ----------

export type ReportValueKind = "text" | "date" | "number" | "percent" | "money";
export interface ReportColumn {
  key: string;
  label: string;
  kind: ReportValueKind;
}
export type ReportCell = string | number | null;
export type ReportRow = Record<string, ReportCell>;
export interface ReportStat {
  label: string;
  value: number | null;
  kind: Exclude<ReportValueKind, "text" | "date">;
}
export interface ReportBody {
  columns: ReportColumn[];
  rows: ReportRow[];
  summary: ReportStat[];
}
export interface Report extends ReportBody {
  kind: ReportKind;
  from: string;
  to: string;
  branchId: string | null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
const pct = (part: number, whole: number | null) => (whole && whole > 0 ? round1((part / whole) * 100) : null);
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const mean = (values: number[]) => (values.length ? sum(values) / values.length : null);
const num = (label: string, value: number | null): ReportStat => ({ label, value, kind: "number" });
const byTime = <T extends { startsAt: Date }>(a: T, b: T) => a.startsAt.getTime() - b.startsAt.getTime();
const byName = (a: string, b: string) => a.localeCompare(b, "en");

// ---------- Attendance ----------

export interface AttendanceSource {
  startsAt: Date;
  name: string;
  branch: string;
  headcount: number | null;
  checkIns: number;
  children: number;
}

export function buildAttendanceReport(services: AttendanceSource[]): ReportBody {
  const rows = [...services].sort(byTime).map((s) => ({
    date: localDateTime(s.startsAt),
    service: s.name,
    branch: s.branch,
    headcount: s.headcount,
    checkIns: s.checkIns,
    children: s.children,
    attendance: reportedAttendance(s.headcount, s.checkIns),
  }));
  const totals = rows.map((r) => r.attendance);
  return {
    columns: [
      { key: "date", label: "Date", kind: "date" },
      { key: "service", label: "Service", kind: "text" },
      { key: "branch", label: "Branch", kind: "text" },
      { key: "headcount", label: "Headcount", kind: "number" },
      { key: "checkIns", label: "Check-ins", kind: "number" },
      { key: "children", label: "Children", kind: "number" },
      { key: "attendance", label: "Attendance", kind: "number" },
    ],
    rows,
    summary: [
      num("Services", rows.length),
      num("Total attendance", sum(totals)),
      num("Average", Math.round(mean(totals) ?? 0)),
      num("Peak", Math.max(0, ...totals)),
      num("Check-ins", sum(rows.map((r) => r.checkIns))),
      num("Children", sum(rows.map((r) => r.children))),
    ],
  };
}

// ---------- Membership growth ----------

export interface MembershipSource {
  people: { createdAt: Date; membershipDate: Date | null; baptismDate: Date | null }[];
  statusTotals: Record<MemberStatus, number>;
}

export function buildMembershipReport(range: ReportRange, source: MembershipSource): ReportBody {
  const months: string[] = [];
  for (let m = range.from.slice(0, 7); m <= range.to.slice(0, 7); ) {
    months.push(m);
    const [y, mo] = m.split("-").map(Number);
    m = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  }
  const buckets = new Map(months.map((month) => [month, { month, newPeople: 0, newMembers: 0, baptisms: 0 }]));
  const inRange = (key: string) => key >= range.from && key <= range.to;
  const add = (key: string | null, field: "newPeople" | "newMembers" | "baptisms") => {
    if (!key || !inRange(key)) return;
    const bucket = buckets.get(key.slice(0, 7));
    if (bucket) bucket[field] += 1;
  };
  // Membership and baptism dates are calendar dates stored at UTC midnight.
  const dateKey = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
  for (const p of source.people) {
    add(localDateKey(p.createdAt), "newPeople");
    add(dateKey(p.membershipDate), "newMembers");
    add(dateKey(p.baptismDate), "baptisms");
  }
  const rows = [...buckets.values()];
  const t = source.statusTotals;
  return {
    columns: [
      { key: "month", label: "Month", kind: "text" },
      { key: "newPeople", label: "New people", kind: "number" },
      { key: "newMembers", label: "New members", kind: "number" },
      { key: "baptisms", label: "Baptisms", kind: "number" },
    ],
    rows,
    summary: [
      num("New people", sum(rows.map((r) => r.newPeople))),
      num("New members", sum(rows.map((r) => r.newMembers))),
      num("Baptisms", sum(rows.map((r) => r.baptisms))),
      num("Visitors now", t.VISITOR),
      num("Regulars now", t.REGULAR),
      num("Members now", t.MEMBER),
      num("Inactive now", t.INACTIVE),
    ],
  };
}

// ---------- Ministry participation ----------

export interface MinistrySource {
  ministries: { id: string; name: string; category: string; branch: string }[];
  roster: { ministryId: string; memberId: string; position: string; joinedAt: Date; leftAt: Date | null }[];
  /** People who are not archived and not Inactive. */
  activePeople: number;
}

export function buildMinistryReport(range: ReportRange, source: MinistrySource): ReportBody {
  const start = range.start.getTime();
  const end = range.end.getTime();
  const within = (d: Date | null) => !!d && d.getTime() >= start && d.getTime() < end;
  const activeAtEnd = (r: MinistrySource["roster"][number]) =>
    r.joinedAt.getTime() < end && (!r.leftAt || r.leftAt.getTime() >= end);
  const serving = new Set<string>();

  const rows = [...source.ministries]
    .sort((a, b) => byName(a.name, b.name))
    .map((m) => {
      const roster = source.roster.filter((r) => r.ministryId === m.id);
      const active = roster.filter(activeAtEnd);
      for (const r of active) serving.add(r.memberId);
      return {
        ministry: m.name,
        category: m.category,
        branch: m.branch,
        active: active.length,
        leaders: active.filter((r) => r.position === "LEADER" || r.position === "COLEADER").length,
        joined: roster.filter((r) => within(r.joinedAt)).length,
        left: roster.filter((r) => within(r.leftAt)).length,
      };
    });
  return {
    columns: [
      { key: "ministry", label: "Ministry", kind: "text" },
      { key: "category", label: "Category", kind: "text" },
      { key: "branch", label: "Branch", kind: "text" },
      { key: "active", label: "Active", kind: "number" },
      { key: "leaders", label: "Leaders", kind: "number" },
      { key: "joined", label: "Joined", kind: "number" },
      { key: "left", label: "Left", kind: "number" },
    ],
    rows,
    summary: [
      num("Ministries", rows.length),
      num("People serving", serving.size),
      { label: "Share of people serving", value: pct(serving.size, source.activePeople), kind: "percent" },
    ],
  };
}

// ---------- Event turnout ----------

export interface EventSource {
  startsAt: Date;
  title: string;
  category: string;
  status: string;
  branch: string;
  capacity: number | null;
  registered: number;
  checkedIn: number;
}

export function buildEventReport(events: EventSource[]): ReportBody {
  const rows = [...events].sort(byTime).map((e) => ({
    date: localDateTime(e.startsAt),
    event: e.title,
    category: e.category,
    branch: e.branch,
    status: e.status,
    capacity: e.capacity,
    registered: e.registered,
    checkedIn: e.checkedIn,
    turnout: pct(e.checkedIn, e.registered),
    fill: pct(e.registered, e.capacity),
  }));
  const turnouts = rows.map((r) => r.turnout).filter((v): v is number => v !== null);
  const average = mean(turnouts);
  return {
    columns: [
      { key: "date", label: "Date", kind: "date" },
      { key: "event", label: "Event", kind: "text" },
      { key: "category", label: "Category", kind: "text" },
      { key: "branch", label: "Branch", kind: "text" },
      { key: "status", label: "Status", kind: "text" },
      { key: "capacity", label: "Capacity", kind: "number" },
      { key: "registered", label: "Registered", kind: "number" },
      { key: "checkedIn", label: "Checked in", kind: "number" },
      { key: "turnout", label: "Turnout %", kind: "percent" },
      { key: "fill", label: "Fill %", kind: "percent" },
    ],
    rows,
    summary: [
      num("Events", rows.length),
      num("Registrations", sum(rows.map((r) => r.registered))),
      num("Check-ins", sum(rows.map((r) => r.checkedIn))),
      { label: "Average turnout", value: average === null ? null : round1(average), kind: "percent" },
    ],
  };
}

// ---------- Room utilization ----------

export interface RoomSource {
  rooms: { id: string; name: string; branch: string; capacity: number | null; hourlyRate: number | null }[];
  bookings: { roomId: string; startsAt: Date; endsAt: Date }[];
}

export function buildRoomReport(range: ReportRange, source: RoomSource): ReportBody {
  const start = range.start.getTime();
  const end = range.end.getTime();
  const openHours = range.days * OPEN_HOURS_PER_DAY;

  const rows = [...source.rooms]
    .sort((a, b) => byName(a.name, b.name))
    .map((room) => {
      let ms = 0;
      let count = 0;
      for (const b of source.bookings) {
        if (b.roomId !== room.id) continue;
        const clipped = Math.min(b.endsAt.getTime(), end) - Math.max(b.startsAt.getTime(), start);
        if (clipped <= 0) continue;
        ms += clipped;
        count += 1;
      }
      const hours = ms / (60 * 60 * 1000);
      return {
        room: room.name,
        branch: room.branch,
        capacity: room.capacity,
        bookings: count,
        hours: round2(hours),
        utilization: round1((hours / openHours) * 100),
        hourlyRate: room.hourlyRate,
        value: room.hourlyRate === null ? null : round2(hours * room.hourlyRate),
      };
    });
  const average = mean(rows.map((r) => r.utilization));
  return {
    columns: [
      { key: "room", label: "Room", kind: "text" },
      { key: "branch", label: "Branch", kind: "text" },
      { key: "capacity", label: "Capacity", kind: "number" },
      { key: "bookings", label: "Bookings", kind: "number" },
      { key: "hours", label: "Booked hours", kind: "number" },
      { key: "utilization", label: "Utilization %", kind: "percent" },
      { key: "hourlyRate", label: "Rate per hour", kind: "money" },
      { key: "value", label: "Estimated value", kind: "money" },
    ],
    rows,
    summary: [
      num("Rooms", rows.length),
      num("Booked hours", round2(sum(rows.map((r) => r.hours)))),
      { label: "Average utilization", value: average === null ? null : round1(average), kind: "percent" },
      { label: "Estimated value", value: round2(sum(rows.map((r) => r.value ?? 0))), kind: "money" },
    ],
  };
}

// ---------- CSV ----------

/** Characters that make a spreadsheet treat a cell as a formula. */
const FORMULA_START = /^[=+\-@\t\r]/;

function csvCell(value: ReportCell): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** RFC 4180 CSV with CRLF line endings and a guard against formula injection. */
export function toCsv(columns: ReportColumn[], rows: ReportRow[]): string {
  const lines = [columns.map((c) => csvCell(c.label)), ...rows.map((row) => columns.map((c) => csvCell(row[c.key] ?? null)))];
  return lines.map((cells) => cells.join(",")).join("\r\n") + "\r\n";
}
