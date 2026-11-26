import type { Permission } from "@cms/shared";
import {
  type AppIcon,
  BookBookmarkIcon,
  BoxIcon,
  CalendarIcon,
  ChartBarIcon,
  ClipboardListIcon,
  HeartIcon,
  HistoryIcon,
  HouseIcon,
  LayoutGridIcon,
  MapIcon,
  SettingsIcon,
  UserCogIcon,
  UsersIcon,
} from "@/components/icons";

export const NAV_GROUPS = ["Overview", "People", "Gatherings", "Administration"] as const;
export type NavGroup = (typeof NAV_GROUPS)[number];

export interface NavItem {
  title: string;
  href: string;
  icon: AppIcon;
  group: NavGroup;
  permission?: Permission;
  /** Extra words the quick search matches, for example "kids" for Attendance. */
  keywords?: string[];
  /** Name of a page one level below the module, for the breadcrumb. */
  detail?: string;
  /** Breadcrumb names for fixed pages below the module, keyed by path segment. */
  subpages?: Record<string, string>;
  /** Modules scheduled for later phases render as disabled entries. */
  comingSoon?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutGridIcon, group: "Overview", keywords: ["home", "stats"] },
  { title: "Reports", href: "/reports", icon: ChartBarIcon, group: "Overview", permission: "reports.read", keywords: ["export", "csv", "pdf", "growth", "turnout", "utilization"] },
  { title: "Members", href: "/members", icon: UsersIcon, group: "People", permission: "members.read", keywords: ["people", "directory"], detail: "Details" },
  { title: "Households", href: "/households", icon: HouseIcon, group: "People", permission: "members.read", keywords: ["families"], detail: "Household" },
  { title: "Ministries", href: "/ministries", icon: HeartIcon, group: "People", permission: "ministries.read", keywords: ["volunteers", "roster", "teams"], detail: "Ministry" },
  { title: "Events", href: "/events", icon: CalendarIcon, group: "Gatherings", permission: "events.read", keywords: ["calendar", "registrations", "image", "poster"], detail: "Event", subpages: { design: "Calendar image" } },
  { title: "Attendance", href: "/attendance", icon: ClipboardListIcon, group: "Gatherings", permission: "attendance.read", keywords: ["check-in", "kids", "pickup", "services"], detail: "Service" },
  { title: "School", href: "/school", icon: BookBookmarkIcon, group: "Gatherings", permission: "school.read", keywords: ["classes", "terms", "students"], detail: "Class" },
  { title: "Rooms", href: "/rooms", icon: BoxIcon, group: "Gatherings", permission: "rooms.read", keywords: ["bookings", "hire"], detail: "Room" },
  { title: "Users", href: "/users", icon: UserCogIcon, group: "Administration", permission: "users.read", keywords: ["accounts", "roles"] },
  { title: "Branches", href: "/branches", icon: MapIcon, group: "Administration", permission: "branches.read", keywords: ["campuses"] },
  { title: "Settings", href: "/settings", icon: SettingsIcon, group: "Administration", permission: "settings.read", keywords: ["configuration"] },
  { title: "Audit Log", href: "/audit", icon: HistoryIcon, group: "Administration", permission: "audit.read", keywords: ["history", "changes"] },
];

export function visibleNavItems(permissions: readonly string[]): NavItem[] {
  const granted = new Set(permissions);
  return NAV_ITEMS.filter((item) => !item.permission || granted.has(item.permission));
}

export function navGroups(items: NavItem[]): { label: NavGroup; items: NavItem[] }[] {
  return NAV_GROUPS.map((label) => ({ label, items: items.filter((i) => i.group === label) })).filter((g) => g.items.length > 0);
}

export function breadcrumb(pathname: string): { module: string; href: string; detail: string | null } {
  const item = NAV_ITEMS.find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`)) ?? NAV_ITEMS[0];
  const deeper = pathname !== item.href && pathname.startsWith(`${item.href}/`);
  const segment = pathname.slice(item.href.length + 1).split("/")[0];
  return { module: item.title, href: item.href, detail: deeper ? (item.subpages?.[segment] ?? item.detail ?? "Details") : null };
}

/** Quick search over modules the user can open. */
export function searchNav(items: NavItem[], query: string): NavItem[] {
  const q = query.trim().toLowerCase();
  return items.filter(
    (i) => !i.comingSoon && (!q || i.title.toLowerCase().includes(q) || (i.keywords ?? []).some((k) => k.includes(q))),
  );
}
