"use client";

import type { LoginInput } from "@cms/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { apiFetch } from "@/lib/api-client";
import { useSessionStore, type SessionUser } from "@/stores/session-store";

export const sessionQueryKey = ["auth", "me"] as const;

export function useLogin() {
  const setUser = useSessionStore((s) => s.setUser);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) =>
      apiFetch<SessionUser>("/auth/login", { method: "POST", json: input }),
    onSuccess: (user) => {
      setUser(user);
      queryClient.setQueryData(sessionQueryKey, user);
    },
  });
}

export function useLogout() {
  const clear = useSessionStore((s) => s.clear);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<void>("/auth/logout", { method: "POST" }),
    onSettled: () => {
      clear();
      queryClient.clear();
    },
  });
}

/** Loads the current session and mirrors it into the zustand store. */
export function useSession() {
  const setUser = useSessionStore((s) => s.setUser);
  const query = useQuery({
    queryKey: sessionQueryKey,
    queryFn: () => apiFetch<SessionUser>("/auth/me"),
    retry: false,
    staleTime: 5 * 60_000,
  });
  useEffect(() => {
    if (query.data) setUser(query.data);
  }, [query.data, setUser]);
  return query;
}
