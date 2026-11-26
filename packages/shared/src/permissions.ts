/** Admins run the system, pastors oversee the church, and staff serve through their ministries. */
export const ROLE_KEYS = ["ADMIN", "PASTOR", "STAFF"] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];

export const PERMISSIONS = [
  "users.read",
  "users.manage",
  "roles.manage",
  "branches.read",
  "branches.manage",
  "settings.read",
  "settings.manage",
  "audit.read",
  "members.read",
  "members.manage",
  "ministries.read",
  "ministries.manage",
  "events.read",
  "events.manage",
  "rooms.read",
  "rooms.book",
  "rooms.manage",
  "school.read",
  "school.manage",
  "attendance.read",
  "attendance.manage",
  "attendance.override",
  "reports.read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];


/** Only admins see user accounts, roles, settings, branch setup, and the audit log. */
const ADMIN_ONLY: readonly Permission[] = [
  "users.read",
  "users.manage",
  "roles.manage",
  "settings.read",
  "settings.manage",
  "branches.manage",
  "audit.read",
];

export const ROLE_DEFAULT_PERMISSIONS: Record<RoleKey, readonly Permission[]> = {
  ADMIN: PERMISSIONS,
  // Pastors see and manage everything at every branch except the admin-only areas.
  PASTOR: PERMISSIONS.filter((p) => !ADMIN_ONLY.includes(p)),
  // Staff serve in ministries (for example ushers scan check-ins); they read what they serve and record attendance.
  STAFF: [
    "members.read",
    "ministries.read",
    "events.read",
    "rooms.read",
    "rooms.book",
    "school.read",
    "attendance.read",
    "attendance.manage",
  ],
};
