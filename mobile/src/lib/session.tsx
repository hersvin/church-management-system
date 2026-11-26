import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createApi, type Api } from "./api";
import { API_URL } from "./config";
import { tokenStore } from "./storage";

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roleKey: string;
  branchId: string | null;
  permissions: string[];
}

interface Session {
  api: Api;
  user: SessionUser | null;
  /** True until the stored token has been checked on launch. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  can: (permission: string) => boolean;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const signedOut = useRef(() => {});

  const api = useMemo(
    () =>
      createApi({
        baseUrl: API_URL,
        getToken: () => tokenStore.get(),
        onUnauthorized: () => signedOut.current(),
      }),
    [],
  );

  signedOut.current = () => {
    void tokenStore.clear();
    queryClient.clear();
    setUser(null);
  };

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        if (await tokenStore.get()) {
          const me = await api.request<SessionUser>("/auth/me");
          if (live) setUser(me);
        }
      } catch {
        // An expired or revoked token signs the person out (handled by onUnauthorized).
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [api]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await api.request<{
        accessToken: string;
        user: SessionUser;
        // The app's sign-in route returns a bearer token; /auth/login is the web's cookie sign-in.
      }>("/auth/token", {
        method: "POST",
        json: { email, password },
      });
      if (!result?.accessToken)
        throw new Error("Sign-in failed. The server did not return a session.");
      await tokenStore.set(result.accessToken);
      setUser(result.user);
    },
    [api],
  );

  const signOut = useCallback(async () => {
    try {
      await api.request("/auth/logout", { method: "POST" });
    } catch {
      // Signing out locally still works when the server cannot be reached.
    }
    signedOut.current();
  }, [api]);

  const value = useMemo<Session>(
    () => ({
      api,
      user,
      loading,
      signIn,
      signOut,
      can: (p) => Boolean(user?.permissions.includes(p)),
    }),
    [api, user, loading, signIn, signOut],
  );
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session)
    throw new Error("useSession must be used inside SessionProvider");
  return session;
}
