import type { PublicVideos } from "@cms/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "./api";
import { useSession } from "./session";

export interface MemberProfile {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  occupation: string | null;
  gender: string;
  civilStatus: string | null;
  birthDate: string | null;
  status: string;
  membershipDate: string | null;
  baptismDate: string | null;
  branch: { id: string; name: string };
  household: {
    name: string;
    members: {
      id: string;
      firstName: string;
      lastName: string;
      householdRole: string | null;
    }[];
  } | null;
}

export interface QrCard {
  token: string;
  expiresAt: string;
  svg: string;
}

export interface ServiceItem {
  id: string;
  name: string;
  startsAt: string;
  branch: { name: string; address: string | null };
  myCampus: boolean;
  checkedIn: boolean;
}

export interface MinistryItem {
  id: string;
  name: string;
  description: string | null;
  category: string;
  meetingSchedule: string | null;
  branch: { name: string };
  status: "SERVING" | "PENDING" | null;
}

export interface EventItem {
  id: string;
  title: string;
  description: string | null;
  category: string;
  startsAt: string;
  endsAt: string;
  capacity: number | null;
  registrationRequired: boolean;
  room: { name: string } | null;
  branch: { name: string };
  ministry: { name: string } | null;
  registered: number;
  myRegistrationId: string | null;
}

export interface AttendanceEntry {
  id: string;
  checkedInAt: string;
  service: {
    id: string;
    name: string;
    startsAt: string;
    branch: { name: string };
  } | null;
  event: {
    id: string;
    title: string;
    startsAt: string;
    branch: { name: string };
  } | null;
}

export interface StaffService {
  id: string;
  name: string;
  startsAt: string;
  branch: { name: string };
  checkIns: number;
}

/** Signed-in data hooks. Each reads the person's own data through the /me routes. */
export function useMe<T>(path: string, enabled = true) {
  const { api, user } = useSession();
  return useQuery({
    queryKey: ["me", path, user?.id],
    queryFn: () => api.request<T>(path),
    enabled: enabled && Boolean(user),
  });
}

export const useProfile = () => useMe<MemberProfile>("/me/member");

/**
 * Whether this account is linked to a member record. Staff and admin accounts often are not:
 * they can browse, but the QR card, self check-in, joining, and registering need the link.
 * Undefined while loading.
 */
export function useLinked(): boolean | undefined {
  const profile = useProfile();
  if (profile.isSuccess) return true;
  if (profile.error instanceof ApiError && profile.error.status === 404)
    return false;
  return undefined;
}
export const useQrCard = () => useMe<QrCard>("/me/qr");
export const useServices = () => useMe<ServiceItem[]>("/me/services");
export const useMinistries = () => useMe<MinistryItem[]>("/me/ministries");
export const useEvents = () => useMe<EventItem[]>("/me/events");
export const useAttendance = (enabled = true) =>
  useMe<{ items: AttendanceEntry[]; thisYear: number }>(
    "/me/attendance",
    enabled,
  );

export function useVideos() {
  const { api } = useSession();
  return useQuery({
    queryKey: ["public", "videos"],
    queryFn: () => api.request<PublicVideos>("/public/videos"),
    staleTime: 10 * 60 * 1000,
  });
}

/** Services an usher can scan for: from six hours ago to the end of today, in the usher's branch. */
export function useStaffServices(enabled: boolean) {
  const { api } = useSession();
  return useQuery({
    queryKey: ["staff", "services"],
    enabled,
    queryFn: async () => {
      const from = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      const to = new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString();
      const page = await api.request<{ items: StaffService[] }>(
        `/services?page=1&pageSize=20&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      );
      return page.items;
    },
  });
}

export function useMeMutation<TInput, TResult = unknown>(
  path: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE" = "POST",
) {
  const { api } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (json: TInput) => api.request<TResult>(path, { method, json }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  });
}

export interface Account {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: { key: string; name: string };
  branch: { id: string; name: string } | null;
  photoUpdatedAt: string | null;
  /** Ministries served, with the position when one is set. */
  ministries: { id: string; name: string; position: string | null }[];
}

/** The signed-in account for every role, with the photo version. */
export const useAccount = () => useMe<Account>("/me/account");

export interface EventDetail {
  id: string;
  title: string;
  description: string | null;
  category: string;
  startsAt: string;
  endsAt: string;
  capacity: number | null;
  registrationRequired: boolean;
  status: "SCHEDULED" | "CANCELLED" | string;
  cancelReason: string | null;
  branch: { name: string; address: string | null; phone: string | null };
  room: { name: string; location: string | null } | null;
  ministry: { name: string } | null;
  registered: number;
  myRegistrationId: string | null;
  checkedIn: boolean;
}

export interface ServiceDetail {
  id: string;
  name: string;
  startsAt: string;
  notes: string | null;
  branch: { name: string; address: string | null; phone: string | null };
  myCampus: boolean;
  checkedIn: boolean;
  checkedInAt: string | null;
  checkInOpensAt: string;
  checkInClosesAt: string;
  checkInOpen: boolean;
  /** Only for accounts that take attendance. */
  checkIns?: number;
}

export const useEventDetail = (id: string | undefined) =>
  useMe<EventDetail>(`/me/events/${id}`, Boolean(id));
export const useServiceDetail = (id: string | undefined) =>
  useMe<ServiceDetail>(`/me/services/${id}`, Boolean(id));
