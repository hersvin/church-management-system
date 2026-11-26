/** Sample data: school terms, classes, teachers, students, and an attendance pattern. Pure data and date math. */

export interface SampleTerm {
  name: string;
  branchCode: string;
  /** The term starts this many weeks before the anchor Sunday. */
  startWeeksBefore: number;
  lengthWeeks: number;
}

export const SAMPLE_TERMS: SampleTerm[] = [
  { name: "School Year 2026-2027, Term 2", branchCode: "MAIN", startWeeksBefore: 6, lengthWeeks: 16 },
  { name: "School Year 2026-2027, Term 2", branchCode: "NORTH", startWeeksBefore: 6, lengthWeeks: 16 },
];

export interface SampleClass {
  name: string;
  description: string;
  audience: "CHILDREN" | "YOUTH" | "ADULTS";
  ageRange?: string;
  branchCode: string;
  room?: string;
  meetingDay: number;
  startTime: string;
  endTime: string;
  capacity?: number;
  teachers: { person: string; role: "LEAD" | "ASSISTANT" }[];
  students: { person: string; dropped?: boolean }[];
}

export const SAMPLE_CLASSES: SampleClass[] = [
  {
    name: "Teen Bible Study",
    description: "Walking through the Gospel of Mark with discussion and memory verses.",
    audience: "YOUTH",
    ageRange: "13 to 18",
    branchCode: "MAIN",
    room: "Classroom B",
    meetingDay: 0,
    startTime: "10:30",
    endTime: "12:00",
    capacity: 20,
    teachers: [{ person: "Elena Santos", role: "LEAD" }],
    students: [{ person: "Hannah Santos" }, { person: "Chidi Okafor" }, { person: "Joshua Santos" }],
  },
  {
    name: "Foundations of Faith",
    description: "A ten-week course on the basics of the Christian faith for new and returning believers.",
    audience: "ADULTS",
    branchCode: "MAIN",
    room: "Classroom A",
    meetingDay: 3,
    startTime: "18:00",
    endTime: "19:00",
    capacity: 25,
    teachers: [
      { person: "Roberto Santos", role: "LEAD" },
      { person: "Grace Park", role: "ASSISTANT" },
    ],
    students: [{ person: "David Mensah" }, { person: "Isabel Cruz" }, { person: "Emeka Okafor" }, { person: "Ngozi Okafor" }],
  },
  {
    name: "Kids Sunday School",
    description: "Bible stories, songs, and crafts for children.",
    audience: "CHILDREN",
    ageRange: "6 to 11",
    branchCode: "NORTH",
    room: "North Youth Room",
    meetingDay: 0,
    startTime: "09:30",
    endTime: "11:00",
    capacity: 15,
    teachers: [{ person: "Lan Nguyen", role: "LEAD" }],
    students: [{ person: "Anh Nguyen" }],
  },
  {
    name: "New Believers Class",
    description: "Six sessions on prayer, Scripture, and church life.",
    audience: "ADULTS",
    branchCode: "NORTH",
    room: "North Chapel",
    meetingDay: 4,
    startTime: "19:00",
    endTime: "20:30",
    teachers: [{ person: "Margaret Turner", role: "LEAD" }],
    students: [{ person: "Minh Nguyen" }, { person: "Liam Turner" }, { person: "Tomas Silva", dropped: true }],
  },
];

const DAY_MS = 24 * 60 * 60 * 1000;
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

const calendarDate = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (date: string, days: number) => calendarDate(new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS));

/** Calendar date (YYYY-MM-DD) of the anchor Sunday in Manila. */
const sundayDate = (sunday: Date) => calendarDate(new Date(sunday.getTime() + MANILA_OFFSET_MS));

export function termDates(sunday: Date, term: SampleTerm): { startsOn: string; endsOn: string } {
  const startsOn = addDays(sundayDate(sunday), -7 * term.startWeeksBefore);
  return { startsOn, endsOn: addDays(startsOn, 7 * term.lengthWeeks) };
}

/** Weekly session dates on the meeting day from the term start up to (not including) today in Manila. */
export function pastSessionDates(termStartsOn: string, meetingDay: number, now: Date): string[] {
  const today = calendarDate(new Date(now.getTime() + MANILA_OFFSET_MS));
  const dates: string[] = [];
  for (let d = addDays(termStartsOn, meetingDay); d < today; d = addDays(d, 7)) dates.push(d);
  return dates;
}

/** Deterministic attendance: mostly present, with some late, absent, and excused marks. */
export function sampleAttendance(studentIndex: number, sessionIndex: number): "PRESENT" | "LATE" | "ABSENT" | "EXCUSED" {
  const n = (studentIndex * 5 + sessionIndex * 3) % 13;
  if (n === 0) return "ABSENT";
  if (n === 1) return "LATE";
  if (n === 2) return "EXCUSED";
  return "PRESENT";
}
