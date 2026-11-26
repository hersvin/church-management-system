/** Sample data: rooms, the event schedule, and a pending booking request. Pure data, no database access, so it is easy to test. */

/** Hourly rates are in pesos and match the room hire plans on the public site. */
export const SAMPLE_ROOMS = [
  { name: "Sanctuary", branchCode: "MAIN", capacity: 400, hourlyRate: 6000, location: "Main building, ground floor", features: ["Sound system", "Projector", "Piano", "Livestream"] },
  { name: "Fellowship Hall", branchCode: "MAIN", capacity: 150, hourlyRate: 2500, location: "Annex", features: ["Kitchen", "Tables", "Projector"] },
  { name: "Classroom A", branchCode: "MAIN", capacity: 30, hourlyRate: 500, location: "Education wing, 2nd floor", features: ["Whiteboard", "TV"] },
  { name: "Classroom B", branchCode: "MAIN", capacity: 25, hourlyRate: 450, location: "Education wing, 2nd floor", features: ["Whiteboard"] },
  { name: "North Chapel", branchCode: "NORTH", capacity: 120, hourlyRate: 2000, location: "Main hall", features: ["Sound system", "Projector"] },
  { name: "North Youth Room", branchCode: "NORTH", capacity: 40, hourlyRate: 600, location: "Basement", features: ["Games", "TV"] },
  { name: "South Hall", branchCode: "SOUTH", capacity: 200, hourlyRate: 3000, location: "Main hall", features: ["Sound system", "Stage"] },
  { name: "Prayer Room", branchCode: "SOUTH", capacity: 15, hourlyRate: 300, location: "Second floor", features: [] },
];

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC instant of 00:00 Manila time on the next Sunday strictly after `now`. */
export function nextSundayManila(now: Date): Date {
  const local = new Date(now.getTime() + MANILA_OFFSET_MS);
  const daysAhead = 7 - local.getUTCDay();
  const midnightLocalAsUtc = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + daysAhead);
  return new Date(midnightLocalAsUtc - MANILA_OFFSET_MS);
}

/** Wall-clock time in Manila, `dayOffset` days after the anchor Sunday, as a UTC instant. */
export function manilaTime(sunday: Date, dayOffset: number, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(sunday.getTime() + dayOffset * DAY_MS + (h * 60 + m) * 60 * 1000);
}

export interface SampleEvent {
  title: string;
  description?: string;
  category: "SERVICE" | "MEETING" | "CLASS" | "OUTREACH" | "FELLOWSHIP" | "CONFERENCE" | "OTHER";
  branchCode: string;
  room?: string;
  ministry?: string;
  /** Days after the anchor Sunday (0 = Sunday). */
  day: number;
  start: string;
  end: string;
  /** Number of weekly occurrences (1 = single event). */
  weeks: number;
  registrationRequired?: boolean;
  capacity?: number;
  registrants?: string[];
  guests?: string[];
}

export const SAMPLE_EVENTS: SampleEvent[] = [
  { title: "Sunday First Service", category: "SERVICE", branchCode: "MAIN", room: "Sanctuary", day: 0, start: "08:00", end: "09:30", weeks: 8 },
  { title: "Sunday Second Service", category: "SERVICE", branchCode: "MAIN", room: "Sanctuary", day: 0, start: "10:30", end: "12:00", weeks: 8 },
  { title: "Kids Church", category: "CLASS", branchCode: "MAIN", room: "Classroom A", day: 0, start: "10:30", end: "12:00", weeks: 8 },
  { title: "Midweek Prayer", category: "MEETING", branchCode: "MAIN", room: "Fellowship Hall", day: 3, start: "19:00", end: "20:30", weeks: 8 },
  { title: "Dance Practice", category: "MEETING", branchCode: "MAIN", room: "Fellowship Hall", ministry: "Dance", day: 6, start: "14:00", end: "16:00", weeks: 8 },
  { title: "Worship Team Rehearsal", category: "MEETING", branchCode: "MAIN", room: "Sanctuary", ministry: "Worship", day: 4, start: "19:00", end: "21:00", weeks: 8 },
  {
    title: "Christmas Concert",
    description: "An evening of carols and special numbers from the Worship ministry. Free entry; please register so we can prepare seating.",
    category: "FELLOWSHIP",
    branchCode: "MAIN",
    room: "Sanctuary",
    ministry: "Worship",
    day: 20,
    start: "18:00",
    end: "20:30",
    weeks: 1,
    registrationRequired: true,
    capacity: 300,
    registrants: ["Roberto Santos", "Grace Park", "David Mensah", "Isabel Cruz"],
    guests: ["Maria Lopez", "James Carter"],
  },
  { title: "North Family Service", category: "SERVICE", branchCode: "NORTH", room: "North Chapel", day: 0, start: "09:30", end: "11:00", weeks: 8 },
  { title: "North Youth Night", category: "MEETING", branchCode: "NORTH", room: "North Youth Room", ministry: "Multimedia", day: 5, start: "18:30", end: "21:00", weeks: 8 },
  { title: "South Afternoon Service", category: "SERVICE", branchCode: "SOUTH", room: "South Hall", day: 0, start: "16:00", end: "17:30", weeks: 8 },
  {
    title: "Community Food Drive",
    description: "Packing and delivering grocery bags to families in Springfield South.",
    category: "OUTREACH",
    branchCode: "SOUTH",
    ministry: "Usher",
    day: 6,
    start: "09:00",
    end: "12:00",
    weeks: 1,
    registrationRequired: true,
    capacity: 20,
    registrants: ["Noah Fischer", "Aisha Bello"],
  },
];

/** A pending room request so the approvals queue has something in it. */
export const SAMPLE_BOOKING_REQUEST = {
  room: "Fellowship Hall",
  branchCode: "MAIN",
  requesterEmail: "office.staff@cms.local",
  purpose: "Staff birthday celebration",
  day: 13,
  start: "14:00",
  end: "17:00",
};

export function buildSampleSchedule(sunday: Date) {
  return SAMPLE_EVENTS.map((event) => ({
    ...event,
    occurrences: Array.from({ length: event.weeks }, (_, week) => ({
      startsAt: manilaTime(sunday, event.day + week * 7, event.start),
      endsAt: manilaTime(sunday, event.day + week * 7, event.end),
    })),
  }));
}
