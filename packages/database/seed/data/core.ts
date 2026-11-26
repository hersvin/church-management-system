/** Sample data: roles, branches, user accounts, and settings. Pure data, no database access, so it is easy to test. */
import type { RoleKey } from "@cms/shared";

export const ROLE_NAMES: Record<RoleKey, string> = {
  ADMIN: "Admin",
  PASTOR: "Pastor",
  STAFF: "Staff",
};

export const SAMPLE_BRANCHES = [
  {
    name: "Main Campus",
    code: "MAIN",
    address: "100 Grace Avenue, Springfield",
    phone: "+1 555 0100",
    email: "main@cms.local",
  },
  {
    name: "North Campus",
    code: "NORTH",
    address: "25 Hillside Road, Springfield North",
    phone: "+1 555 0200",
    email: "north@cms.local",
  },
  {
    name: "South Campus",
    code: "SOUTH",
    address: "8 Riverside Drive, Springfield South",
    phone: "+1 555 0300",
    email: "south@cms.local",
  },
] as const;

export interface SampleUser {
  email: string;
  firstName: string;
  lastName: string;
  roleKey: RoleKey;
  branchCode: string | null;
  isActive: boolean;
}

/**
 * Admins and pastors cover every branch. Staff accounts belong to sample members (see SAMPLE_ACCOUNT_LINKS)
 * who serve in the four ministries, so each one sees their ministry's events and ushers get the scanner.
 */
export const SAMPLE_USERS: SampleUser[] = [
  { email: "pastor.john@cms.local", firstName: "John", lastName: "Mercer", roleKey: "PASTOR", branchCode: null, isActive: true },
  { email: "north.admin@cms.local", firstName: "Grace", lastName: "Holloway", roleKey: "ADMIN", branchCode: null, isActive: true },
  { email: "south.admin@cms.local", firstName: "Daniel", lastName: "Reyes", roleKey: "ADMIN", branchCode: null, isActive: true },
  { email: "staff.grace@cms.local", firstName: "Grace", lastName: "Park", roleKey: "STAFF", branchCode: "MAIN", isActive: true },
  { email: "staff.elena@cms.local", firstName: "Elena", lastName: "Santos", roleKey: "STAFF", branchCode: "MAIN", isActive: true },
  { email: "staff.david@cms.local", firstName: "David", lastName: "Mensah", roleKey: "STAFF", branchCode: "MAIN", isActive: true },
  { email: "usher.roberto@cms.local", firstName: "Roberto", lastName: "Santos", roleKey: "STAFF", branchCode: "MAIN", isActive: true },
  { email: "member.ngozi@cms.local", firstName: "Ngozi", lastName: "Okafor", roleKey: "STAFF", branchCode: "MAIN", isActive: true },
];

export const SAMPLE_SETTINGS: { key: string; value: unknown; branchCode: string | null }[] = [
  { key: "church.name", value: "Grace Community Church", branchCode: null },
  { key: "church.tagline", value: "A place to belong, believe, and become.", branchCode: null },
  { key: "church.email", value: "hello@cms.local", branchCode: null },
  { key: "church.phone", value: "+1 555 0100", branchCode: null },
  { key: "church.timezone", value: "Asia/Manila", branchCode: null },
  // Grace Testament Church on YouTube (@gtcphofficial); the landing page shows its newest videos.
  { key: "youtube.channel_id", value: "UCcC2zfFwZ8WF4NhCk5yYs2g", branchCode: null },
  { key: "branding.primary_color", value: "#1d4ed8", branchCode: null },
  {
    key: "service.times",
    value: [
      { day: "Sunday", time: "08:00", label: "First Service" },
      { day: "Sunday", time: "10:30", label: "Second Service" },
      { day: "Wednesday", time: "19:00", label: "Midweek Prayer" },
    ],
    branchCode: null,
  },
  {
    key: "service.times",
    value: [{ day: "Sunday", time: "09:30", label: "Family Service" }],
    branchCode: "NORTH",
  },
  {
    key: "service.times",
    value: [{ day: "Sunday", time: "16:00", label: "Afternoon Service" }],
    branchCode: "SOUTH",
  },
];

/** Sample accounts linked to their member record, so they can use the mobile app as themselves. */
export const SAMPLE_ACCOUNT_LINKS: { userEmail: string; memberEmail: string }[] = [
  { userEmail: "staff.grace@cms.local", memberEmail: "grace.park@cms.local" },
  { userEmail: "staff.elena@cms.local", memberEmail: "elena.santos@cms.local" },
  { userEmail: "staff.david@cms.local", memberEmail: "david.mensah@cms.local" },
  { userEmail: "usher.roberto@cms.local", memberEmail: "roberto.santos@cms.local" },
  { userEmail: "member.ngozi@cms.local", memberEmail: "ngozi.okafor@cms.local" },
];
