import { REPORT_KINDS, type ReportCell, type ReportKind, type ReportQuery, type ReportValueKind } from "@cms/shared";
import type { GlyphState } from "@/components/status-glyph";

export const REPORT_META: Record<ReportKind, { label: string; description: string }> = {
  attendance: { label: "Attendance", description: "Every worship service in the range: headcount, check-ins, children." },
  membership: { label: "Membership growth", description: "New people, new members, and baptisms by month." },
  ministries: { label: "Ministry participation", description: "Who serves where, and who joined or left in the range." },
  events: { label: "Event turnout", description: "Registrations against check-ins for every event in the range." },
  rooms: { label: "Room utilization", description: "Approved booking hours against 14 open hours a day, valued at each room's rate." },
};

const NUMBER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** One cell or summary value as text. Empty values show "--" so a blank never reads as zero. */
export function formatReportValue(value: ReportCell, kind: ReportValueKind): string {
  if (value === null || value === "") return "--";
  if (typeof value === "string") return value;
  switch (kind) {
    case "percent":
      return `${NUMBER.format(value)}%`;
    case "money": {
      const whole = Number.isInteger(value);
      return `₱${value.toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
    }
    default:
      return NUMBER.format(value);
  }
}

const isKind = (v: string | null): v is ReportKind => !!v && (REPORT_KINDS as readonly string[]).includes(v);

/** The report and filters a URL asks for. Unknown kinds fall back to attendance; blank filters are dropped. */
export function readReportParams(params: URLSearchParams): { kind: ReportKind; query: ReportQuery } {
  const kind = params.get("kind");
  const query: ReportQuery = {};
  for (const key of ["from", "to", "branchId"] as const) {
    const value = params.get(key);
    if (value) query[key] = value;
  }
  return { kind: isKind(kind) ? kind : "attendance", query };
}

/** Search string for a report query, without empty values. */
export function reportSearch(query: { from?: string; to?: string; branchId?: string }): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
  return params.toString();
}

/** Shareable link to a report with its filters. */
export function reportHref(kind: ReportKind, query: { from?: string; to?: string; branchId?: string }): string {
  const rest = reportSearch(query);
  return `/reports?kind=${kind}${rest ? `&${rest}` : ""}`;
}

interface RoomWithBookings {
  id: string;
  name: string;
  bookings?: { id: string; startsAt: string; endsAt: string; purpose: string }[];
}

export interface RoomUsage {
  id: string;
  name: string;
  inUse: boolean;
  bookings: { id: string; startsAt: string; endsAt: string; purpose: string; state: GlyphState }[];
}

/** Rooms booked today, those in use right now first; each booking is done, active, or waiting. */
export function roomUsageToday(rooms: RoomWithBookings[], now: Date): RoomUsage[] {
  const t = now.getTime();
  return rooms
    .filter((r) => (r.bookings?.length ?? 0) > 0)
    .map((r) => {
      const bookings = [...(r.bookings ?? [])]
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
        .map((b) => {
          const start = Date.parse(b.startsAt);
          const end = Date.parse(b.endsAt);
          const state: GlyphState = end <= t ? "done" : start <= t ? "active" : "waiting";
          return { ...b, state };
        });
      return { id: r.id, name: r.name, inUse: bookings.some((b) => b.state === "active"), bookings };
    })
    .sort((a, b) => Number(b.inUse) - Number(a.inUse) || a.name.localeCompare(b.name));
}
