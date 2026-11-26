import type {
  PlaylistCreateInput,
  PlaylistSaveInput,
  SongCreateInput,
} from "@cms/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import type {
  CatalogResults,
  LibrarySong,
  PlaylistDetail,
  PlaylistDraft,
  PlaylistSummary,
} from "./music";
import { useSession } from "./session";

export interface CatalogQuery {
  q: string;
  field: "any" | "title" | "artist";
  genre?: string;
}

/** Search runs only when the person presses Search, never on every keystroke. */
export function useCatalogSearch(query: CatalogQuery | null) {
  const { api } = useSession();
  return useQuery({
    queryKey: ["music", "search", query],
    enabled: Boolean(query && query.q.trim().length >= 2),
    queryFn: () => {
      const params = new URLSearchParams({
        q: query!.q.trim(),
        field: query!.field,
      });
      if (query!.genre?.trim()) params.set("genre", query!.genre.trim());
      return api.request<CatalogResults>(`/music/search?${params.toString()}`);
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function usePlaylists() {
  const { api } = useSession();
  return useQuery({
    queryKey: ["music", "playlists"],
    queryFn: () => api.request<PlaylistSummary[]>("/music/playlists"),
  });
}

export function usePlaylist(id: string | null) {
  const { api } = useSession();
  return useQuery({
    queryKey: ["music", "playlist", id],
    enabled: Boolean(id),
    queryFn: () => api.request<PlaylistDetail>(`/music/playlists/${id}`),
  });
}

/** Every music change refreshes the lists, so screens agree after a save. */
function useMusicMutation<TInput, TResult>(
  fn: (input: TInput) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["music"] }),
  });
}

export function useMusicActions() {
  const { api } = useSession();
  return {
    addSong: useMusicMutation((input: SongCreateInput) =>
      api.request<LibrarySong>("/music/songs", { method: "POST", json: input }),
    ),
    createPlaylist: useMusicMutation((input: PlaylistCreateInput) =>
      api.request<{ id: string; name: string }>("/music/playlists", {
        method: "POST",
        json: input,
      }),
    ),
    addToPlaylist: useMusicMutation(
      ({
        id,
        songId,
        selectedKey,
      }: {
        id: string;
        songId: string;
        selectedKey: string | null;
      }) =>
        api.request(`/music/playlists/${id}/songs`, {
          method: "POST",
          json: { songId, selectedKey },
        }),
    ),
    savePlaylist: useMusicMutation(
      ({ id, body }: { id: string; body: PlaylistSaveInput }) =>
        api.request<PlaylistDetail>(`/music/playlists/${id}/songs`, {
          method: "PUT",
          json: body,
        }),
    ),
    duplicatePlaylist: useMusicMutation((id: string) =>
      api.request<{ id: string; name: string }>(
        `/music/playlists/${id}/duplicate`,
        { method: "POST" },
      ),
    ),
    deletePlaylist: useMusicMutation((id: string) =>
      api.request(`/music/playlists/${id}`, { method: "DELETE" }),
    ),
  };
}

/**
 * Unsaved playlist work, kept in memory per playlist while the app is open, so arranging survives
 * moving between screens. Saving or discarding clears it. It is never written to the device.
 */
const drafts = new Map<string, PlaylistDraft>();
let current: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
let version = 0;

export const musicStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getDraft: (id: string | null) => (id ? drafts.get(id) : undefined),
  setDraft(draft: PlaylistDraft) {
    drafts.set(draft.id, draft);
    version += 1;
    emit();
  },
  clearDraft(id: string) {
    drafts.delete(id);
    version += 1;
    emit();
  },
  getCurrent: () => current,
  setCurrent(id: string | null) {
    current = id;
    version += 1;
    emit();
  },
};

/** Re-renders when any draft or the current playlist changes. */
export function useMusicStore() {
  useSyncExternalStore(musicStore.subscribe, () => version);
  return musicStore;
}

export interface SongWithChart extends LibrarySong {
  chart: string | null;
  updatedAt: string;
}

export function useSong(id: string | undefined) {
  const { api } = useSession();
  return useQuery({
    queryKey: ["music", "song", id],
    enabled: Boolean(id),
    queryFn: () => api.request<SongWithChart>(`/music/songs/${id}`),
  });
}

export function useSaveChart() {
  const { api } = useSession();
  return useMusicMutation(
    ({
      id,
      chart,
      originalKey,
    }: {
      id: string;
      chart: string | null;
      originalKey?: string | null;
    }) =>
      api.request<SongWithChart>(`/music/songs/${id}`, {
        method: "PATCH",
        json: originalKey === undefined ? { chart } : { chart, originalKey },
      }),
  );
}

export interface LibraryListItem extends LibrarySong {
  updatedAt: string;
  hasChart: boolean;
}

export interface LibraryQuery {
  q?: string;
  sort: "title" | "artist" | "key" | "updated";
  originalKey?: string;
  hasChart?: boolean;
}

export function useLibrary(query: LibraryQuery) {
  const { api } = useSession();
  return useQuery({
    queryKey: ["music", "library", query],
    queryFn: () => {
      const params = new URLSearchParams({ sort: query.sort });
      if (query.q?.trim()) params.set("q", query.q.trim());
      if (query.originalKey) params.set("originalKey", query.originalKey);
      if (query.hasChart !== undefined)
        params.set("hasChart", String(query.hasChart));
      return api.request<LibraryListItem[]>(
        `/music/songs?${params.toString()}`,
      );
    },
  });
}
