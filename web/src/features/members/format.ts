import type { MemberStatus } from "@cms/shared";

interface NameParts {
  firstName: string;
  middleName?: string | null;
  lastName: string;
  suffix?: string | null;
}

export function fullName(m: NameParts): string {
  return [m.firstName, m.middleName, m.lastName, m.suffix].filter(Boolean).join(" ");
}

export function initials(m: NameParts): string {
  return `${m.firstName.charAt(0)}${m.lastName.charAt(0)}`.toUpperCase();
}

export function ageFrom(birthDate: string | null | undefined, now = new Date()): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export type BadgeTone = "default" | "secondary" | "outline" | "muted" | "destructive";

const TONES: Record<MemberStatus, BadgeTone> = {
  MEMBER: "default",
  REGULAR: "secondary",
  VISITOR: "outline",
  INACTIVE: "muted",
};

export const statusTone = (status: MemberStatus): BadgeTone => TONES[status];

export const STATUS_LABELS: Record<MemberStatus, string> = {
  VISITOR: "Visitor",
  REGULAR: "Regular attendee",
  MEMBER: "Member",
  INACTIVE: "Inactive",
};

export function buildMemberQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, raw] of Object.entries(params)) {
    const value = typeof raw === "string" ? raw.trim() : raw;
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  return search.toString();
}

/** Formats an ISO date (date-only columns arrive as midnight UTC) without timezone drift. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}
