"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, Lock } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

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

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => router.push("/dashboard"), 600);
  };

  return (
    <div>
      <h1 className="text-center font-display text-3xl font-extrabold tracking-tight text-secondary">
        Sign in to GlobeTrotter
      </h1>
      <p className="mt-2 text-center text-text-secondary">
        Pick up right where you left off planning.
      </p>

      <form onSubmit={onSubmit} className="mt-7 space-y-4">
        <Input
          name="username"
          type="text"
          label="Username"
          placeholder="your_username"
          defaultValue="smruti"
          leftIcon={<User className="h-4 w-4" />}
          required
        />
        <Input
          name="password"
          type="password"
          label="Password"
          placeholder="••••••••"
          defaultValue="password"
          leftIcon={<Lock className="h-4 w-4" />}
          required
        />

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

        <Button type="submit" size="lg" className="w-full" loading={loading}>
          {loading ? "Signing in…" : "Log In"}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs font-medium text-text-muted">
        <span className="h-px flex-1 bg-border" />
        OR CONTINUE WITH
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button
        variant="outline"
        size="lg"
        className="w-full"
        onClick={() => router.push("/dashboard")}
      >
        <GoogleIcon /> Google
      </Button>

      <p className="mt-8 text-center text-sm text-text-secondary">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-semibold text-primary hover:underline">
          Create account
        </Link>
      </p>
    </div>
  );
}
