/** Sample data: weekly worship services and a deterministic attendance pattern. Pure data and date math. */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface SampleService {
  name: string;
  branchCode: string;
  /** Manila wall-clock start, HH:MM, on Sunday. */
  time: string;
  /** Typical usher headcount; weekly numbers vary around it. */
  baseHeadcount: number;
  /** Whether sample members check in to this service. Only one service per branch does. */
  checkIns: boolean;
}

export const SAMPLE_SERVICES: SampleService[] = [
  { name: "Sunday Worship 9 AM", branchCode: "MAIN", time: "09:00", baseHeadcount: 220, checkIns: true },
  { name: "Sunday Worship 5 PM", branchCode: "MAIN", time: "17:00", baseHeadcount: 140, checkIns: false },
  { name: "Sunday Worship 10 AM", branchCode: "NORTH", time: "10:00", baseHeadcount: 95, checkIns: true },
  { name: "Sunday Worship 9 AM", branchCode: "SOUTH", time: "09:00", baseHeadcount: 70, checkIns: true },
];

/** Weeks of past services to create before the anchor Sunday. */
export const PAST_SERVICE_WEEKS = 8;

/** The Sundays before the anchor, newest first. */
export function pastServiceSundays(sunday: Date, weeks: number): Date[] {
  return Array.from({ length: weeks }, (_, i) => new Date(sunday.getTime() - (i + 1) * 7 * DAY_MS));
}

/** Most people attend most weeks; the pattern shifts per person so every week differs. */
export function attendsService(personIndex: number, weekIndex: number): boolean {
  return (personIndex * 3 + weekIndex * 5) % 7 !== 0 && (personIndex + weekIndex * 2) % 9 !== 4;
}

export function sampleHeadcount(service: SampleService, weekIndex: number): number {
  const swing = ((weekIndex * 37 + service.time.length * 11) % 23) - 11;
  return service.baseHeadcount + swing * Math.max(1, Math.round(service.baseHeadcount / 60));
}
