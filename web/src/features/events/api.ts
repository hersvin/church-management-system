"use client";

import type { BookingStatus, EventCategory, EventStatus, MinistryCategory } from "@cms/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { buildMemberQuery } from "@/features/members/format";
import { apiFetch } from "@/lib/api-client";

export interface ChurchEvent {
  id: string;
  title: string;
  description: string | null;
  category: EventCategory;
  startsAt: string;
  endsAt: string;
  capacity: number | null;
  registrationRequired: boolean;
  status: EventStatus;
  cancelReason: string | null;
  seriesId: string | null;
  branchId: string;
  branch: { id: string; name: string; code: string };
  ministryId: string | null;
  ministry: { id: string; name: string; category: MinistryCategory } | null;
  roomId: string | null;
  room: { id: string; name: string } | null;
  booking: { id: string; status: BookingStatus; decisionNote?: string | null } | null;
  _count: { registrations: number };
}

export interface ChurchEventDetail extends ChurchEvent {
  series: { id: string; startsAt: string }[];
}

export interface Registration {
  id: string;
  createdAt: string;
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  memberId: string | null;
  member: { id: string; firstName: string; lastName: string; email: string | null; phone: string | null } | null;
}

export interface EventFilters {
  from: string;
  to: string;
  category?: EventCategory;
  search?: string;
}

/** Raw JSON payloads: dates stay as strings so the API does the parsing. */
export type EventPayload = Record<string, unknown>;

function useInvalidate() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["events"] }),
      queryClient.invalidateQueries({ queryKey: ["bookings"] }),
      queryClient.invalidateQueries({ queryKey: ["rooms"] }),
    ]);
}

export const useEvents = (filters: EventFilters) =>
  useQuery({
    queryKey: ["events", "list", filters],
    queryFn: () => apiFetch<ChurchEvent[]>(`/events?${buildMemberQuery({ ...filters })}`),
    placeholderData: keepPreviousData,
  });

export const useUpcomingEvents = (limit = 5, enabled = true) =>
  useQuery({
    queryKey: ["events", "upcoming", limit],
    queryFn: () => apiFetch<ChurchEvent[]>(`/events/upcoming?limit=${limit}`),
    enabled,
  });

export const useEvent = (id: string) =>
  useQuery({ queryKey: ["events", "detail", id], queryFn: () => apiFetch<ChurchEventDetail>(`/events/${id}`) });

export const useRegistrations = (id: string, enabled = true) =>
  useQuery({
    queryKey: ["events", "registrations", id],
    queryFn: () => apiFetch<Registration[]>(`/events/${id}/registrations`),
    enabled,
  });

export function useCreateEvent() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (payload: EventPayload) =>
      apiFetch<{ count: number; seriesId: string | null; items: { id: string }[] }>("/events", { method: "POST", json: payload }),
    onSuccess: invalidate,
  });
}

export function useUpdateEvent(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (payload: EventPayload) => apiFetch<ChurchEvent>(`/events/${id}`, { method: "PATCH", json: payload }),
    onSuccess: invalidate,
  });
}

export function useCancelEvent(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (payload: { scope: "THIS" | "FOLLOWING"; reason?: string }) =>
      apiFetch<{ cancelled: number }>(`/events/${id}/cancel`, { method: "POST", json: payload }),
    onSuccess: invalidate,
  });
}

export function useRegister(eventId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (payload: EventPayload) =>
      apiFetch<Registration>(`/events/${eventId}/registrations`, { method: "POST", json: payload }),
    onSuccess: invalidate,
  });
}

export function useCancelRegistration(eventId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (registrationId: string) =>
      apiFetch<void>(`/events/${eventId}/registrations/${registrationId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}
