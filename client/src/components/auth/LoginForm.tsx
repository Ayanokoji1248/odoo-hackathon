"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowRight, Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordField } from "./PasswordField";
import { login } from "@/lib/api/auth";
import { ApiError, fieldErrors } from "@/lib/api/client";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  // Set by anything that bounced someone here mid-task - the public trip page
  // does it when a signed-out visitor tries to copy a trip. Returning them to
  // where they were beats dumping them on the dashboard.
  const next = params.get("next");

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setFormError(null);
    setFields({});

    const form = new FormData(e.currentTarget);
    try {
      const user = await login(
        String(form.get("email") ?? ""),
        String(form.get("password") ?? "")
      );
      // Admins land where their work is; `next` still wins if something sent them.
      router.replace(next ?? (user.role === "admin" ? "/admin" : "/dashboard"));
    } catch (err) {
      const perField = fieldErrors(err);
      setFields(perField);
      // Only show the banner when nothing could be pinned to a field, so the same
      // problem is never reported twice on one screen.
      setFormError(
        Object.keys(perField).length > 0
          ? null
          : err instanceof ApiError
            ? err.message
            : "Could not sign in. Check your connection and try again."
      );
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        {/* An <h1> for structure, sized like an h2: at a 448px card the display
            face at 36px swamped the form it was introducing. */}
        <h1 className="text-h2 text-secondary">Welcome back</h1>
        <p className="mt-1.5 text-sm leading-6 text-text-secondary">
          Sign in to pick up your itineraries, budgets and saved places.
        </p>
      </div>

      {formError && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-2.5 rounded-xl border border-error/25 bg-red-50 p-3.5"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
          <p className="text-sm font-medium text-error">{formError}</p>
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Input
          name="email"
          type="email"
          label="Email"
          placeholder="you@example.com"
          autoComplete="email"
          // Phones default to capitalising the first letter, which breaks emails.
          autoCapitalize="off"
          spellCheck={false}
          autoFocus
          leftIcon={<Mail className="h-4 w-4" />}
          error={fields.email}
          required
        />

        <div>
          <PasswordField
            name="password"
            placeholder="Your password"
            autoComplete="current-password"
            error={fields.password}
            required
          />
          <div className="mt-2 flex justify-end">
            {/* Deliberately not crimson: the only primary-coloured control on
                this screen is the one we want pressed. */}
            <Link
              href="/forgot-password"
              className="rounded-md text-sm text-text-secondary underline-offset-2 hover:text-text-primary hover:underline"
            >
              Forgot your password?
            </Link>
          </div>
        </div>

        <Button type="submit" size="lg" className="w-full" loading={loading}>
          {/* Label stays put while loading - a spinner that also changes the text
              makes the button jump exactly when it must feel reliable. */}
          Sign in
          {!loading && <ArrowRight className="h-4 w-4" />}
        </Button>
      </form>

      <p className="mt-7 border-t border-border pt-5 text-center text-sm text-text-secondary">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
