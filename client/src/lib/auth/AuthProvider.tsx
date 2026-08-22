"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { User } from "@/types";
import { getCurrentUser, logout as logoutRequest } from "@/lib/api/auth";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  /** Re-read /auth/me — call after any mutation that changes the profile. */
  reload: () => Promise<void>;
  logout: () => Promise<void>;
}

interface AuthState {
  user: User | null;
  status: AuthStatus;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchAuthState(): Promise<AuthState> {
  try {
    return { user: await getCurrentUser(), status: "authenticated" };
  } catch {
    // apiFetch already retried once via /auth/refresh, so reaching here means
    // the session is genuinely gone — not merely a stale access token.
    return { user: null, status: "unauthenticated" };
  }
}

/**
 * Holds the signed-in user for a whole route group.
 *
 * The session cookies are httpOnly, so the client cannot inspect them — the only
 * way to know who is signed in is to ask the server. We do that once when the
 * provider mounts and keep the answer in context, rather than having every
 * component fetch /auth/me for itself.
 *
 * This runs on the client on purpose. Reading the user in a server component
 * would avoid the loading flash, but a server component cannot set cookies, so
 * it could not perform the /auth/refresh rotation — every hard navigation with
 * an expired 15-minute access token would look like a logout. `apiFetch`
 * handles that refresh, so we go through it.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [{ user, status }, setState] = useState<AuthState>({
    user: null,
    status: "loading",
  });

  useEffect(() => {
    // `cancelled` guards against a resolve landing after unmount — and against
    // StrictMode's double-mount in dev writing the first fetch's result twice.
    let cancelled = false;
    void fetchAuthState().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const reload = useCallback(async () => {
    setState(await fetchAuthState());
  }, []);

  const logout = useCallback(async () => {
    // Ignore failures: the server revokes the session row and clears the
    // cookies, and if the call fails we still want the UI signed out.
    await logoutRequest().catch(() => undefined);
    setState({ user: null, status: "unauthenticated" });
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, status, reload, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}

/**
 * The user, guaranteed non-null. Only valid below <RequireAuth>, which does not
 * render its children until the user is loaded — so consumers skip the null
 * check instead of inventing a placeholder for a state that cannot happen.
 */
export function useUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error("useUser must be used inside <RequireAuth>");
  return user;
}
