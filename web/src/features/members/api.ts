"use client";

import type {
  CivilStatus,
  Gender,
  HouseholdCreateInput,
  HouseholdRole,
  MemberCreateInput,
  MemberStatus,
  MemberUpdateInput,
} from "@cms/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Page } from "@/features/admin/queries";
import { apiFetch } from "@/lib/api-client";
import { buildMemberQuery } from "./format";

interface BranchRef {
  id: string;
  name: string;
  code: string;
}

export interface Member {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  gender: Gender;
  civilStatus: CivilStatus | null;
  birthDate: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  occupation: string | null;
  status: MemberStatus;
  membershipDate: string | null;
  baptismDate: string | null;
  notes: string | null;
  householdRole: HouseholdRole | null;
  createdAt: string;
  branchId: string;
  branch: BranchRef;
  householdId: string | null;
  household: { id: string; name: string } | null;
}

export interface MemberDetail extends Member {
  statusHistory: {
    id: string;
    fromStatus: MemberStatus | null;
    toStatus: MemberStatus;
    note: string | null;
    changedAt: string;
  }[];
}

export interface Household {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  branchId: string;
  branch: BranchRef;
  _count?: { members: number };
}

export interface HouseholdDetail extends Household {
  members: Member[];
}

export interface MemberStats {
  total: number;
  byStatus: Record<MemberStatus, number>;
  newThisMonth: number;
  households: number;
}

export interface MemberFilters {
  page: number;
  pageSize: number;
  search?: string;
  status?: MemberStatus;
  householdId?: string;
}

export const memberKeys = {
  all: ["members"] as const,
  list: (f: MemberFilters) => ["members", "list", f] as const,
  detail: (id: string) => ["members", "detail", id] as const,
  stats: ["members", "stats"] as const,
  households: (search: string, page: number) => ["households", "list", search, page] as const,
  household: (id: string) => ["households", "detail", id] as const,
};

export const useMembers = (filters: MemberFilters) =>
  useQuery({
    queryKey: memberKeys.list(filters),
    queryFn: () => apiFetch<Page<Member>>(`/members?${buildMemberQuery({ ...filters })}`),
    placeholderData: keepPreviousData,
  });

export const useMember = (id: string) =>
  useQuery({ queryKey: memberKeys.detail(id), queryFn: () => apiFetch<MemberDetail>(`/members/${id}`) });

export const useMemberStats = (enabled = true) =>
  useQuery({ queryKey: memberKeys.stats, queryFn: () => apiFetch<MemberStats>("/members/stats"), enabled });

export const useHouseholds = (search = "", page = 1, pageSize = 20) =>
  useQuery({
    queryKey: memberKeys.households(search, page),
    queryFn: () =>
      apiFetch<Page<Household>>(`/households?${buildMemberQuery({ page, pageSize, search })}`),
    placeholderData: keepPreviousData,
  });

export const useHousehold = (id: string) =>
  useQuery({ queryKey: memberKeys.household(id), queryFn: () => apiFetch<HouseholdDetail>(`/households/${id}`) });

function useInvalidateMembers() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["members"] }),
      queryClient.invalidateQueries({ queryKey: ["households"] }),
    ]);
}

export function useCreateMember() {
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: (input: MemberCreateInput) => apiFetch<Member>("/members", { method: "POST", json: input }),
    onSuccess: invalidate,
  });
}

export function useUpdateMember(id: string) {
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: (input: MemberUpdateInput) =>
      apiFetch<Member>(`/members/${id}`, { method: "PATCH", json: input }),
    onSuccess: invalidate,
  });
}

export function useArchiveMember() {
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/members/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

export function useCreateHousehold() {
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: (input: HouseholdCreateInput) =>
      apiFetch<Household>("/households", { method: "POST", json: input }),
    onSuccess: invalidate,
  });
}
