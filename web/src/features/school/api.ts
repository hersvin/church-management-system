"use client";

import type { AttendanceStatus, ClassAudience, EnrollmentStatus, MemberStatus, TeacherRole } from "@cms/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Page } from "@/features/admin/queries";
import { buildMemberQuery } from "@/features/members/format";
import { apiFetch } from "@/lib/api-client";

type Person = { id: string; firstName: string; lastName: string; status?: MemberStatus; email?: string | null };

export interface Term {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  branchId: string;
  branch: { id: string; name: string; code: string };
  _count: { classes: number };
}

export interface SchoolClass {
  id: string;
  name: string;
  description: string | null;
  audience: ClassAudience;
  ageRange: string | null;
  meetingDay: number | null;
  startTime: string | null;
  endTime: string | null;
  capacity: number | null;
  termId: string;
  term: { id: string; name: string; startsOn: string; endsOn: string; branchId: string };
  roomId: string | null;
  room: { id: string; name: string } | null;
  attendanceRate: number | null;
}

export interface ClassListItem extends SchoolClass {
  teachers: { id: string; role: TeacherRole; member: Person }[];
  _count: { enrollments: number };
}

export interface ClassDetail extends SchoolClass {
  teachers: { id: string; role: TeacherRole; memberId: string; member: Person }[];
  enrollments: {
    id: string;
    status: EnrollmentStatus;
    grade: string | null;
    note: string | null;
    enrolledAt: string;
    memberId: string;
    member: Person;
    attendanceRate: number | null;
  }[];
}

export interface SessionSummary {
  id: string;
  date: string;
  topic: string | null;
  recorded: number;
  counts: Partial<Record<AttendanceStatus, number>>;
  attendanceRate: number | null;
}

export interface RegisterRow {
  enrollmentId: string;
  member: Person;
  status: AttendanceStatus | null;
  note: string | null;
}

export interface SessionDetail {
  session: { id: string; date: string; topic: string | null; notes: string | null; classId: string };
  register: RegisterRow[];
}

export interface MemberSchool {
  enrollments: {
    id: string;
    status: EnrollmentStatus;
    grade: string | null;
    attendanceRate: number | null;
    class: { id: string; name: string; audience: ClassAudience; term: { name: string } };
  }[];
  teaching: { id: string; role: TeacherRole; class: { id: string; name: string; audience: ClassAudience; term: { name: string } } }[];
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["school"] });
}

/** A mutation that refreshes all school queries when it succeeds. */
function useInvalidatingMutation<TInput, TResult = unknown>(fn: (input: TInput) => Promise<TResult>) {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: fn, onSuccess: invalidate });
}

export const useTerms = () => useQuery({ queryKey: ["school", "terms"], queryFn: () => apiFetch<Term[]>("/school/terms") });

export const useClasses = (params: { termId?: string; audience?: ClassAudience; search?: string }, enabled = true) =>
  useQuery({
    queryKey: ["school", "classes", params],
    queryFn: () => apiFetch<Page<ClassListItem>>(`/school/classes?${buildMemberQuery({ page: 1, pageSize: 100, ...params })}`),
    placeholderData: keepPreviousData,
    enabled,
  });

export const useClass = (id: string) =>
  useQuery({ queryKey: ["school", "class", id], queryFn: () => apiFetch<ClassDetail>(`/school/classes/${id}`) });

export const useSessions = (classId: string) =>
  useQuery({ queryKey: ["school", "sessions", classId], queryFn: () => apiFetch<SessionSummary[]>(`/school/classes/${classId}/sessions`) });

export const useSession = (sessionId: string | null) =>
  useQuery({
    queryKey: ["school", "session", sessionId],
    queryFn: () => apiFetch<SessionDetail>(`/school/sessions/${sessionId}`),
    enabled: Boolean(sessionId),
  });

export const useSchoolStats = (enabled = true) =>
  useQuery({
    queryKey: ["school", "stats"],
    queryFn: () => apiFetch<{ activeClasses: number; students: number; attendanceRate: number | null }>("/school/stats"),
    enabled,
  });

export const useMemberSchool = (memberId: string, enabled = true) =>
  useQuery({ queryKey: ["school", "member", memberId], queryFn: () => apiFetch<MemberSchool>(`/members/${memberId}/school`), enabled });

export const useCreateTerm = () =>
  useInvalidatingMutation((input: Record<string, unknown>) => apiFetch<Term>("/school/terms", { method: "POST", json: input }));

export const useUpdateTerm = (id: string) =>
  useInvalidatingMutation((input: Record<string, unknown>) => apiFetch<Term>(`/school/terms/${id}`, { method: "PATCH", json: input }));

export const useCreateClass = () =>
  useInvalidatingMutation((input: Record<string, unknown>) => apiFetch<SchoolClass>("/school/classes", { method: "POST", json: input }));

export const useUpdateClass = (id: string) =>
  useInvalidatingMutation((input: Record<string, unknown>) => apiFetch<SchoolClass>(`/school/classes/${id}`, { method: "PATCH", json: input }));

export const useArchiveClass = () => useInvalidatingMutation((id: string) => apiFetch<void>(`/school/classes/${id}`, { method: "DELETE" }));

export const useAddTeacher = (classId: string) =>
  useInvalidatingMutation((input: { memberId: string; role: TeacherRole }) =>
    apiFetch(`/school/classes/${classId}/teachers`, { method: "POST", json: input }),
  );

export const useRemoveTeacher = (classId: string) =>
  useInvalidatingMutation((memberId: string) => apiFetch<void>(`/school/classes/${classId}/teachers/${memberId}`, { method: "DELETE" }));

export const useEnroll = (classId: string) =>
  useInvalidatingMutation((memberId: string) => apiFetch(`/school/classes/${classId}/enrollments`, { method: "POST", json: { memberId } }));

export const useUpdateEnrollment = () =>
  useInvalidatingMutation(({ id, ...input }: { id: string; status: "COMPLETED" | "DROPPED"; grade?: string; note?: string }) =>
    apiFetch(`/school/enrollments/${id}`, { method: "PATCH", json: input }),
  );

export const useCreateSession = (classId: string) =>
  useInvalidatingMutation((input: { date: string; topic?: string }) =>
    apiFetch<{ id: string }>(`/school/classes/${classId}/sessions`, { method: "POST", json: input }),
  );

export const useSaveAttendance = (sessionId: string) =>
  useInvalidatingMutation((records: { enrollmentId: string; status: AttendanceStatus; note?: string }[]) =>
    apiFetch<SessionDetail>(`/school/sessions/${sessionId}/attendance`, { method: "PUT", json: { records } }),
  );
