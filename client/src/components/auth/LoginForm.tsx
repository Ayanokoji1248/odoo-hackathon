"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, Lock } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

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
      <h1 className="text-h1 text-text-primary">Welcome back</h1>
      <p className="mt-2 text-text-secondary">
        Sign in to continue planning your next adventure.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <Input
          name="username"
          type="text"
          label="Username"
          placeholder="your_username"
          defaultValue="smruti"
          leftIcon={<User className="h-4 w-4" />}
          required
        />
        <div>
          <Input
            name="password"
            type="password"
            label="Password"
            placeholder="••••••••"
            defaultValue="password"
            leftIcon={<Lock className="h-4 w-4" />}
            required
          />
          <div className="mt-2 text-right">
            <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
        </div>

        <Button type="submit" size="lg" className="w-full" loading={loading}>
          {loading ? "Signing in…" : "Log In"}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-caption text-text-muted">
        <span className="h-px flex-1 bg-border" />
        OR
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button variant="outline" size="lg" className="w-full" onClick={() => router.push("/dashboard")}>
        Continue with Google
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
