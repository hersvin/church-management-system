/**
 * Pure model for the calendar image: which days and events the poster shows, and the grid
 * geometry the canvas renderer draws into. Dates use the browser's local time, like the calendar.
 */

export interface PosterEvent {
  id: string;
  title: string;
  category: string;
  status: string;
  startsAt: string;
  endsAt: string;
  branchId: string;
  room: string | null;
}

export interface PosterEntry {
  id: string;
  title: string;
  category: string;
  time: string;
  room: string | null;
  dateLabel: string;
}

export interface PosterDay {
  key: string;
  day: number;
  inMonth: boolean;
  entries: PosterEntry[];
}

export type EventEdits = Record<string, { title?: string; hidden?: boolean }>;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const pad = (n: number) => String(n).padStart(2, "0");
const dayKeyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** "9:00 AM" in local time. */
export function timeLabel(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(d.getMinutes())} ${h < 12 ? "AM" : "PM"}`;
}

export function monthLabel(month: string): { month: string; year: string } {
  const [y, m] = month.split("-").map(Number);
  return { month: MONTHS[m - 1], year: String(y) };
}

export function buildPoster({
  month,
  events,
  weekStart,
  branchId,
  edits = {},
}: {
  /** YYYY-MM */
  month: string;
  events: PosterEvent[];
  /** 0 = Sunday, 1 = Monday */
  weekStart: 0 | 1;
  branchId?: string;
  edits?: EventEdits;
}) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0);
  const lead = (first.getDay() - weekStart + 7) % 7;
  const totalDays = Math.ceil((lead + last.getDate()) / 7) * 7;

  const byDay = new Map<string, PosterEntry[]>();
  const sorted = [...events]
    .filter((e) => e.status !== "CANCELLED" && (!branchId || e.branchId === branchId) && !edits[e.id]?.hidden)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  for (const e of sorted) {
    const start = new Date(e.startsAt);
    const key = dayKeyOf(start);
    const entry: PosterEntry = {
      id: e.id,
      title: edits[e.id]?.title?.trim() || e.title,
      category: e.category,
      time: timeLabel(e.startsAt),
      room: e.room,
      dateLabel: `${WEEKDAYS[start.getDay()].toUpperCase()} ${pad(start.getDate())}`,
    };
    byDay.set(key, [...(byDay.get(key) ?? []), entry]);
  }

  const days: PosterDay[] = Array.from({ length: totalDays }, (_, i) => {
    const date = new Date(y, m - 1, 1 - lead + i);
    const key = dayKeyOf(date);
    const inMonth = date.getMonth() === m - 1;
    return { key, day: date.getDate(), inMonth, entries: inMonth ? (byDay.get(key) ?? []) : [] };
  });
  const weeks = Array.from({ length: totalDays / 7 }, (_, w) => days.slice(w * 7, w * 7 + 7));

  return {
    weeks,
    weekdays: [...WEEKDAYS.slice(weekStart), ...WEEKDAYS.slice(0, weekStart)],
    list: days.filter((d) => d.inMonth).flatMap((d) => d.entries),
    ...monthLabel(month),
  };
}

export type Poster = ReturnType<typeof buildPoster>;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Seven equal columns and `rows` equal rows inside `area`, `gap` apart. */
export function gridGeometry(area: Rect, rows: number, gap: number) {
  const cellWidth = (area.width - gap * 6) / 7;
  const cellHeight = (area.height - gap * (rows - 1)) / rows;
  const cell = (row: number, col: number): Rect => ({
    x: area.x + col * (cellWidth + gap),
    y: area.y + row * (cellHeight + gap),
    width: cellWidth,
    height: cellHeight,
  });
  const hit = (x: number, y: number): { row: number; col: number } | null => {
    const col = Math.floor((x - area.x) / (cellWidth + gap));
    const row = Math.floor((y - area.y) / (cellHeight + gap));
    if (col < 0 || col > 6 || row < 0 || row >= rows) return null;
    const c = cell(row, col);
    return x <= c.x + c.width && y <= c.y + c.height ? { row, col } : null;
  };
  return { cellWidth, cellHeight, cell, hit };
}
