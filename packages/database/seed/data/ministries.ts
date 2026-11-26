/** Sample data: ministries, volunteer roles, and rosters. Pure data, no database access, so it is easy to test. */

export interface SampleMinistry {
  name: string;
  description: string;
  category: "WORSHIP" | "CHILDREN" | "YOUTH" | "ADULTS" | "OUTREACH" | "PRAYER" | "HOSPITALITY" | "MEDIA" | "OTHER";
  meetingSchedule: string;
  branchCode: string;
  roles: string[];
  roster: { person: string; position: "LEADER" | "COLEADER" | "MEMBER"; role?: string }[];
}

/**
 * The church's four ministries. They meet at the main campus but serve events at every branch.
 * Positions (ministry roles) are left empty for now; the church office adds them in the admin app.
 */
export const SAMPLE_MINISTRIES: SampleMinistry[] = [
  {
    name: "Multimedia",
    description: "Runs sound, lights, slides, and the livestream for every service and event.",
    category: "MEDIA",
    meetingSchedule: "Tech run Saturdays 4:00 PM",
    branchCode: "MAIN",
    roles: [],
    roster: [
      { person: "Grace Park", position: "LEADER" },
      { person: "Miguel Santos", position: "MEMBER" },
      { person: "Chidi Okafor", position: "MEMBER" },
    ],
  },
  {
    name: "Worship",
    description: "Leads the congregation in worship through music every Sunday service.",
    category: "WORSHIP",
    meetingSchedule: "Rehearsals Thursdays 7:00 PM",
    branchCode: "MAIN",
    roles: [],
    roster: [
      { person: "Elena Santos", position: "LEADER" },
      { person: "Joshua Santos", position: "MEMBER" },
      { person: "Hannah Santos", position: "MEMBER" },
    ],
  },
  {
    name: "Dance",
    description: "Worship through movement for Sunday services and special events.",
    category: "WORSHIP",
    meetingSchedule: "Practice Saturdays 2:00 PM",
    branchCode: "MAIN",
    roles: [],
    roster: [
      { person: "David Mensah", position: "LEADER" },
      { person: "Ada Okafor", position: "MEMBER" },
      { person: "Isabel Cruz", position: "MEMBER" },
    ],
  },
  {
    name: "Usher",
    description: "Welcomes people at the door, seats guests, and checks everyone in.",
    category: "HOSPITALITY",
    meetingSchedule: "Briefing Sundays 7:30 AM",
    branchCode: "MAIN",
    roles: [],
    roster: [
      { person: "Ngozi Okafor", position: "LEADER" },
      { person: "Roberto Santos", position: "MEMBER" },
      { person: "Emeka Okafor", position: "MEMBER" },
    ],
  },
];

/** Earlier sample ministries and where their events move; the seed retires them in existing databases. */
export const RETIRED_MINISTRIES: { name: string; eventsMoveTo: string | null }[] = [
  { name: "Worship Team", eventsMoveTo: "Worship" },
  { name: "Hospitality and Ushers", eventsMoveTo: "Usher" },
  { name: "North Youth", eventsMoveTo: "Multimedia" },
  { name: "Community Outreach", eventsMoveTo: "Usher" },
  { name: "Kids Church", eventsMoveTo: null },
  { name: "Prayer Circle", eventsMoveTo: null },
];
