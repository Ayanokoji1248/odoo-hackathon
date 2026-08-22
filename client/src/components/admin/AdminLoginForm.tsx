"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Mail, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { login, logout } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

/**
 * A separate door to the admin panel, not a separate auth system.
 *
 * It posts to the same `/auth/login` and gets the same session cookies — there is
 * one user table, one password hash, one session mechanism, and one place
 * (`require_admin` on the server router) where admin access is actually decided.
 * A second credential store would double the attack surface and give two things
 * to keep in sync, for no gain that this screen does not already provide.
 *
 * What is genuinely different: correct credentials for a *non-admin* account do
 * not get you in. The session is revoked again straight away, so the admin door
 * can never leave a plain-user session behind.
 */
export function AdminLoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [refused, setRefused] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setRefused(false);

    const form = new FormData(e.currentTarget);
    try {
      const user = await login(
        String(form.get("email") ?? ""),
        String(form.get("password") ?? "")
      );

      if (user.role !== "admin") {
        // Valid credentials, wrong role. Undo the session rather than silently
        // signing them into the traveller app from the admin screen.
        await logout().catch(() => undefined);
        setRefused(true);
        return;
      }

      // A hard navigation, so the admin layout's provider re-reads /auth/me and
      // sees the new cookies rather than a cached "unauthenticated".
      router.replace("/admin");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not sign in. Is the API running?"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary-light text-secondary">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="text-h1 text-white">Admin sign in</h1>
        <p className="mt-2 text-sm text-white/70">
          Staff access to the catalogue and platform analytics.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-2xl border border-white/10 bg-white/95 p-6 shadow-pop backdrop-blur"
      >
        <Input
          name="email"
          type="email"
          label="Work email"
          placeholder="admin@globetrotter.app"
          leftIcon={<Mail className="h-4 w-4" />}
          autoComplete="email"
          required
        />
        <Input
          name="password"
          type="password"
          label="Password"
          leftIcon={<Lock className="h-4 w-4" />}
          autoComplete="current-password"
          required
        />

        {refused && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Those credentials are valid, but that account is not an administrator.
            You have been signed out again —{" "}
            <Link href="/login" className="font-semibold underline">
              sign in to the app instead
            </Link>
            .
          </div>
        )}
        {error && <p className="text-sm font-medium text-error">{error}</p>}

        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Sign in to admin
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-white/60">
        Not staff?{" "}
        <Link href="/login" className="font-medium text-white hover:underline">
          Traveller sign in
        </Link>
      </p>
    </div>
  );
}
