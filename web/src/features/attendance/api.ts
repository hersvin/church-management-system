"use client";

import type { CheckInCreateInput, CheckInSummary, CheckOutInput } from "@cms/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Page } from "@/features/admin/queries";
import { buildMemberQuery } from "@/features/members/format";
import { apiFetch } from "@/lib/api-client";

type Person = { id: string; firstName: string; lastName: string };

export interface Service {
  id: string;
  name: string;
  startsAt: string;
  headcount: number | null;
  notes: string | null;
  branchId: string;
  branch: { id: string; name: string; code: string };
  checkIns: number;
  children: number;
  attendance: number;
}

export interface CheckInRow {
  id: string;
  kind: "ATTENDEE" | "CHILD";
  memberId: string | null;
  guestName: string | null;
  guestPhone: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  careNote: string | null;
  checkedInAt: string;
  checkedOutAt: string | null;
  pickedUpByName: string | null;
  overrideReason: string | null;
  member: (Person & { birthDate: string | null }) | null;
  guardianMember: Person | null;
  pickedUpByMember: Person | null;
  locked: boolean;
  registered: boolean | null;
}

export interface CheckInList {
  summary: CheckInSummary;
  registered: number | null;
  items: CheckInRow[];
}

export interface Guardians {
  guardianName: string | null;
  guardianPhone: string | null;
  members: (Person & { householdRole: string | null; phone: string | null })[];
}

export interface AttendanceStats {
  weeks: { weekOf: string; attendance: number; checkIns: number; children: number; services: number }[];
  childrenInCare: number;
}

export interface MemberAttendance {
  items: {
    id: string;
    kind: "ATTENDEE" | "CHILD";
    checkedInAt: string;
    service: { id: string; name: string; startsAt: string } | null;
    event: { id: string; title: string; startsAt: string } | null;
  }[];
  recentCount: number;
  recentWeeks: number;
}

/** What people check in to: a worship service or an event. */
export type CheckInTarget = { type: "service" | "event"; id: string };

const targetPath = (t: CheckInTarget) => `/${t.type === "service" ? "services" : "events"}/${t.id}/check-ins`;

function useInvalidatingMutation<TInput, TResult = unknown>(fn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attendance"] }) });
}

export const useServices = (params: { page: number; from?: string; to?: string; branchId?: string }) =>
  useQuery({
    queryKey: ["attendance", "services", params],
    queryFn: () => apiFetch<Page<Service>>(`/services?${buildMemberQuery({ pageSize: 20, ...params })}`),
    placeholderData: keepPreviousData,
  });

export const useService = (id: string) =>
  useQuery({ queryKey: ["attendance", "service", id], queryFn: () => apiFetch<Service>(`/services/${id}`) });

export const useCheckIns = (target: CheckInTarget, enabled = true) =>
  useQuery({
    queryKey: ["attendance", "check-ins", target.type, target.id],
    queryFn: () => apiFetch<CheckInList>(targetPath(target)),
    enabled,
    // Several stations check people in at once; keep the list fresh.
    refetchInterval: 15_000,
  });

export const useGuardians = (checkInId: string | null) =>
  useQuery({
    queryKey: ["attendance", "guardians", checkInId],
    queryFn: () => apiFetch<Guardians>(`/check-ins/${checkInId}/guardians`),
    enabled: Boolean(checkInId),
  });

export const useAttendanceStats = (enabled = true) =>
  useQuery({ queryKey: ["attendance", "stats"], queryFn: () => apiFetch<AttendanceStats>("/attendance/stats"), enabled });

export const useMemberAttendance = (memberId: string, enabled = true) =>
  useQuery({
    queryKey: ["attendance", "member", memberId],
    queryFn: () => apiFetch<MemberAttendance>(`/members/${memberId}/attendance`),
    enabled,
  });

export const useCreateService = () =>
  useInvalidatingMutation((input: Record<string, unknown>) => apiFetch<Service>("/services", { method: "POST", json: input }));

export const useUpdateService = (id: string) =>
  useInvalidatingMutation((input: Record<string, unknown>) => apiFetch<Service>(`/services/${id}`, { method: "PATCH", json: input }));

export const useArchiveService = () => useInvalidatingMutation((id: string) => apiFetch<void>(`/services/${id}`, { method: "DELETE" }));

export const useCheckIn = (target: CheckInTarget) =>
  useInvalidatingMutation((input: CheckInCreateInput) =>
    apiFetch<CheckInRow & { pickupCode?: string }>(targetPath(target), { method: "POST", json: input }),
  );

export const useCheckOut = (checkInId: string) =>
  useInvalidatingMutation((input: CheckOutInput) => apiFetch(`/check-ins/${checkInId}/checkout`, { method: "POST", json: input }));

export const useUndoCheckIn = () => useInvalidatingMutation((id: string) => apiFetch<void>(`/check-ins/${id}`, { method: "DELETE" }));
