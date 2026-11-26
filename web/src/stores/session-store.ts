import type { Permission, RoleKey } from "@cms/shared";
import { create } from "zustand";

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roleKey: RoleKey;
  branchId: string | null;
  permissions: string[];
}

interface SessionState {
  user: SessionUser | null;
  setUser: (user: SessionUser) => void;
  clear: () => void;
  can: (permission: Permission) => boolean;
}

export const useSessionStore = create<SessionState>()((set, get) => ({
  user: null,
  setUser: (user) => set({ user }),
  clear: () => set({ user: null }),
  can: (permission) => get().user?.permissions.includes(permission) ?? false,
}));
