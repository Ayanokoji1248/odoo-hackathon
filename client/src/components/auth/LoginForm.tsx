"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { login } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
    </svg>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    try {
      await login(String(form.get("email") ?? ""), String(form.get("password") ?? ""));
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to sign in");
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="text-center md:text-left">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary sm:text-sm">
          Welcome back
        </p>
        <h1 className="mt-2 text-balance font-display text-3xl font-extrabold leading-tight text-secondary sm:text-4xl">
          Sign in to GlobeTrotter
        </h1>
        <p className="mt-2 max-w-sm text-pretty text-sm leading-6 text-text-secondary sm:text-base md:max-w-md">
          Continue planning trips, comparing cities, and keeping every booking detail in one place.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Input
          name="email"
          type="email"
          label="Email address"
          placeholder="you@example.com"
          autoComplete="email"
          leftIcon={<Mail className="h-4 w-4" />}
          required
        />
        <Input
          name="password"
          type="password"
          label="Password"
          placeholder="Enter your password"
          autoComplete="current-password"
          leftIcon={<Lock className="h-4 w-4" />}
          required
        />
        {error && (
          <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-error ring-1 ring-red-100">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              defaultChecked
              className="h-4 w-4 rounded border-border text-primary accent-primary focus:ring-primary/30"
            />
            Remember me
          </label>
          <Link href="/forgot-password" className="text-sm font-semibold text-primary hover:underline">
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full rounded-xl shadow-[0_14px_28px_rgba(199,0,50,0.2)]"
          loading={loading}
        >
          {loading ? "Signing in..." : "Log in"}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs font-medium text-text-muted">
        <span className="h-px flex-1 bg-border" />
        Continue another way
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button variant="outline" size="lg" className="w-full rounded-xl border-secondary-light bg-white" disabled>
        <GoogleIcon /> Google
      </Button>

      <p className="mt-6 text-center text-sm text-text-secondary">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-semibold text-primary hover:underline">
          Create account
        </Link>
      </p>
    </div>
  );
}
