"use client";

import type {
  MemberStatus,
  MinistryCategory,
  MinistryCreateInput,
  MinistryMemberAddInput,
  MinistryMemberUpdateInput,
  MinistryPosition,
  MinistryUpdateInput,
} from "@cms/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Page } from "@/features/admin/queries";
import { buildMemberQuery } from "@/features/members/format";
import { apiFetch } from "@/lib/api-client";

export interface MinistryRole {
  id: string;
  name: string;
}

export interface RosterEntry {
  id: string;
  position: MinistryPosition;
  joinedAt: string;
  leftAt: string | null;
  memberId: string;
  member: {
    id: string;
    firstName: string;
    lastName: string;
    status: MemberStatus;
    email: string | null;
    phone: string | null;
  };
  ministryRole: MinistryRole | null;
}

export interface Ministry {
  id: string;
  name: string;
  description: string | null;
  category: MinistryCategory;
  meetingSchedule: string | null;
  isActive: boolean;
  branchId: string;
  branch: { id: string; name: string; code: string };
  _count?: { members: number };
  members?: { position: MinistryPosition; member: { id: string; firstName: string; lastName: string } }[];
}

export interface MinistryDetail extends Omit<Ministry, "members"> {
  roles: MinistryRole[];
  members: RosterEntry[];
}

export interface MemberMinistry {
  id: string;
  position: MinistryPosition;
  joinedAt: string;
  leftAt: string | null;
  ministry: { id: string; name: string; category: MinistryCategory; isActive: boolean };
  ministryRole: MinistryRole | null;
}

export interface MinistryFilters {
  page: number;
  pageSize: number;
  search?: string;
  category?: MinistryCategory;
}

export const ministryKeys = {
  list: (f: MinistryFilters) => ["ministries", "list", f] as const,
  detail: (id: string) => ["ministries", "detail", id] as const,
  stats: ["ministries", "stats"] as const,
  forMember: (memberId: string) => ["ministries", "member", memberId] as const,
};

export const useMinistries = (filters: MinistryFilters) =>
  useQuery({
    queryKey: ministryKeys.list(filters),
    queryFn: () => apiFetch<Page<Ministry>>(`/ministries?${buildMemberQuery({ ...filters })}`),
    placeholderData: keepPreviousData,
  });

export const useMinistry = (id: string) =>
  useQuery({ queryKey: ministryKeys.detail(id), queryFn: () => apiFetch<MinistryDetail>(`/ministries/${id}`) });

export const useMinistryStats = (enabled = true) =>
  useQuery({
    queryKey: ministryKeys.stats,
    queryFn: () => apiFetch<{ ministries: number; participants: number }>("/ministries/stats"),
    enabled,
  });

export const useMemberMinistries = (memberId: string, enabled = true) =>
  useQuery({
    queryKey: ministryKeys.forMember(memberId),
    queryFn: () => apiFetch<MemberMinistry[]>(`/members/${memberId}/ministries`),
    enabled,
  });

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["ministries"] });
}

export function useCreateMinistry() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: MinistryCreateInput) => apiFetch<Ministry>("/ministries", { method: "POST", json: input }),
    onSuccess: invalidate,
  });
}

export function useUpdateMinistry(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: MinistryUpdateInput) =>
      apiFetch<Ministry>(`/ministries/${id}`, { method: "PATCH", json: input }),
    onSuccess: invalidate,
  });
}

export function useArchiveMinistry() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/ministries/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

export function useAddRole(ministryId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<MinistryRole>(`/ministries/${ministryId}/roles`, { method: "POST", json: { name } }),
    onSuccess: invalidate,
  });
}

export function useRemoveRole(ministryId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (roleId: string) =>
      apiFetch<void>(`/ministries/${ministryId}/roles/${roleId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

export function useAddRosterMember(ministryId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: MinistryMemberAddInput) =>
      apiFetch<RosterEntry>(`/ministries/${ministryId}/members`, { method: "POST", json: input }),
    onSuccess: invalidate,
  });
}

export function useUpdateRosterMember(ministryId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ memberId, input }: { memberId: string; input: MinistryMemberUpdateInput }) =>
      apiFetch<RosterEntry>(`/ministries/${ministryId}/members/${memberId}`, { method: "PATCH", json: input }),
    onSuccess: invalidate,
  });
}

export function useRemoveRosterMember(ministryId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (memberId: string) =>
      apiFetch<void>(`/ministries/${ministryId}/members/${memberId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}
