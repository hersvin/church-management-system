import type { RoleKey } from "@cms/shared";

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roleKey: RoleKey;
  branchId: string | null;
  permissions: string[];
}

export interface TokenPayload {
  sub: string;
  ver: number;
}

export const SESSION_COOKIE = "cms_session";

export function isChurchWide(user: SessionUser): boolean {
  // Admins and pastors oversee every branch; any account without a branch is church-wide too.
  return user.roleKey === "ADMIN" || user.roleKey === "PASTOR" || user.branchId === null;
}
