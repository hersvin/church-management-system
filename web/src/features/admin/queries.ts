"use client";

import type { UserCreateInput, UserUpdateInput } from "@cms/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UserRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  lastLoginAt: string | null;
  branchId: string | null;
  memberId: string | null;
  member: { id: string; firstName: string; lastName: string } | null;
  role: { key: string; name: string };
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
}

export interface Role {
  id: string;
  key: string;
  name: string;
  permissions: string[];
}

export interface AuditRow {
  id: string;
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export const adminKeys = {
  users: (page: number) => ["users", page] as const,
  branches: ["branches"] as const,
  roles: ["roles"] as const,
  settings: ["settings"] as const,
  audit: (page: number) => ["audit", page] as const,
};

export const useUsers = (page = 1, enabled = true) =>
  useQuery({
    queryKey: adminKeys.users(page),
    queryFn: () => apiFetch<Page<UserRow>>(`/users?page=${page}&pageSize=20`),
    enabled,
  });

export const useBranches = (enabled = true) =>
  useQuery({ queryKey: adminKeys.branches, queryFn: () => apiFetch<Branch[]>("/branches"), enabled });

export const useRoles = (enabled = true) =>
  useQuery({ queryKey: adminKeys.roles, queryFn: () => apiFetch<Role[]>("/roles"), enabled });

export const useSettings = () =>
  useQuery({ queryKey: adminKeys.settings, queryFn: () => apiFetch<Record<string, unknown>>("/settings") });

export const useAudit = (page = 1, enabled = true) =>
  useQuery({
    queryKey: adminKeys.audit(page),
    queryFn: () => apiFetch<Page<AuditRow>>(`/audit?page=${page}&pageSize=20`),
    enabled,
  });

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UserCreateInput) => apiFetch<UserRow>("/users", { method: "POST", json: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UserUpdateInput }) =>
      apiFetch<UserRow>(`/users/${id}`, { method: "PATCH", json: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}
