"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import type { UserRole } from "@/types";

interface RequireAuthProps {
  children: ReactNode;
  /** When set, an authenticated user without one of these roles is sent away. */
  roles?: UserRole[];
  /** Where to send a user who fails the check. */
  redirectTo?: string;
}

function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <span className="sr-only">Loading your account…</span>
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
    </div>
  );
}

/**
 * Renders children only once we know who the user is.
 *
 * Gating here means every component below can call `useUser()` without a null
 * check. It is a UX gate, not a security boundary: the page has already been
 * sent to the browser by the time this runs. Anything that must not leak has to
 * be enforced by the API (`get_current_user` / `AdminUser` server-side), which
 * is where the real check lives.
 */
export function RequireAuth({ children, roles, redirectTo = "/login" }: RequireAuthProps) {
  const { status, user } = useAuth();
  const router = useRouter();

  const roleAllowed = !roles || (user ? roles.includes(user.role) : false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(redirectTo);
    } else if (status === "authenticated" && !roleAllowed) {
      // Signed in, wrong role — back to the app rather than to the login page,
      // which would look like the session broke.
      router.replace("/dashboard");
    }
  }, [status, roleAllowed, router, redirectTo]);

  if (status !== "authenticated" || !roleAllowed) return <FullPageLoader />;
  return <>{children}</>;
}
