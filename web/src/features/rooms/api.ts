"use client";

import type { BookingStatus, RoomCreateInput, RoomUpdateInput } from "@cms/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Page } from "@/features/admin/queries";
import { buildMemberQuery } from "@/features/members/format";
import { apiFetch } from "@/lib/api-client";

export interface Room {
  id: string;
  name: string;
  capacity: number | null;
  location: string | null;
  description: string | null;
  features: string[];
  isActive: boolean;
  /** Hire rate per hour in pesos; null when no rate is set. */
  hourlyRate: number | null;
  branchId: string;
  branch: { id: string; name: string; code: string };
  /** Today's approved bookings (list endpoint only). */
  bookings?: { id: string; startsAt: string; endsAt: string; purpose: string }[];
}

export interface Booking {
  id: string;
  startsAt: string;
  endsAt: string;
  purpose: string;
  status: BookingStatus;
  decisionNote: string | null;
  requestedById: string | null;
  roomId: string;
  room: { id: string; name: string; branchId: string };
  event: { id: string; title: string } | null;
}

export interface BookingPayload {
  roomId: string;
  purpose: string;
  startsAt: string;
  endsAt: string;
}

const invalidateAll = (queryClient: ReturnType<typeof useQueryClient>) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: ["rooms"] }),
    queryClient.invalidateQueries({ queryKey: ["bookings"] }),
    queryClient.invalidateQueries({ queryKey: ["events"] }),
  ]);

export const useRooms = (params: { page?: number; pageSize?: number; search?: string; branchId?: string } = {}, enabled = true) =>
  useQuery({
    queryKey: ["rooms", "list", params],
    queryFn: () => apiFetch<Page<Room>>(`/rooms?${buildMemberQuery({ page: 1, pageSize: 50, ...params })}`),
    placeholderData: keepPreviousData,
    enabled,
  });

export const useRoom = (id: string) =>
  useQuery({ queryKey: ["rooms", "detail", id], queryFn: () => apiFetch<Room>(`/rooms/${id}`) });

export const useBookings = (params: { from: string; to: string; roomId?: string; status?: BookingStatus }, enabled = true) =>
  useQuery({
    queryKey: ["bookings", "list", params],
    queryFn: () => apiFetch<Booking[]>(`/bookings?${buildMemberQuery({ ...params })}`),
    enabled,
  });

export const usePendingBookings = (enabled = true) =>
  useQuery({ queryKey: ["bookings", "pending"], queryFn: () => apiFetch<Booking[]>("/bookings/pending"), enabled });

export function useCreateRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RoomCreateInput) => apiFetch<Room>("/rooms", { method: "POST", json: input }),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useUpdateRoom(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RoomUpdateInput) => apiFetch<Room>(`/rooms/${id}`, { method: "PATCH", json: input }),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useArchiveRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/rooms/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BookingPayload) => apiFetch<Booking>("/bookings", { method: "POST", json: input }),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useDecideBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: "approve" | "reject"; note?: string }) =>
      apiFetch<Booking>(`/bookings/${id}/${decision}`, { method: "POST", json: note ? { note } : {} }),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useCancelBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<Booking>(`/bookings/${id}/cancel`, { method: "POST" }),
    onSuccess: () => invalidateAll(queryClient),
  });
}
