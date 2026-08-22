"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Check, Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordField } from "./PasswordField";
import { register } from "@/lib/api/auth";
import { PASSWORD_MIN } from "@/lib/api/users";
import { ApiError, fieldErrors } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";

/**
 * Four fields, not eight.
 *
 * This form used to ask for phone, city, country and a free-text "additional
 * information" box at the door. Every one of them is optional server-side, and
 * every one of them is a reason to abandon a sign-up. They live in Settings now,
 * which is a real screen that saves.
 */
export function SignupForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [password, setPassword] = useState("");

  const longEnough = password.length >= PASSWORD_MIN;

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setFormError(null);
    setFields({});

    const form = new FormData(e.currentTarget);
    const field = (key: string) => String(form.get(key) ?? "").trim();

    if (!longEnough) {
      setFields({ password: `Use at least ${PASSWORD_MIN} characters` });
      setLoading(false);
      return;
    }

    try {
      await register({
        firstName: field("firstName"),
        lastName: field("lastName"),
        email: field("email"),
        password: String(form.get("password") ?? ""),
      });
      router.replace("/dashboard");
    } catch (err) {
      const perField = fieldErrors(err);
      // The API names fields as the columns are named; the inputs are camelCase.
      setFields({
        ...perField,
        firstName: perField.first_name,
        lastName: perField.last_name,
      });
      setFormError(
        Object.keys(perField).length > 0
          ? null
          : err instanceof ApiError
            ? err.message
            : "Could not create your account. Please try again."
      );
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-h2 text-secondary">Create your account</h1>
        <p className="mt-1.5 text-sm leading-6 text-text-secondary">
          Free, and takes about twenty seconds.
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            name="firstName"
            label="First name"
            placeholder="Jane"
            autoComplete="given-name"
            autoFocus
            error={fields.firstName}
            required
          />
          <Input
            name="lastName"
            label="Last name"
            placeholder="Traveller"
            autoComplete="family-name"
            error={fields.lastName}
            required
          />
        </div>

        <Input
          name="email"
          type="email"
          label="Email"
          placeholder="you@example.com"
          autoComplete="email"
          autoCapitalize="off"
          spellCheck={false}
          leftIcon={<Mail className="h-4 w-4" />}
          error={fields.email}
          required
        />

        <div>
          <PasswordField
            name="password"
            placeholder="Create a password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fields.password}
            required
          />
          {/* Live, and stated before they can get it wrong. Hidden once the API
              has something to say about this field, so the rule and the error do
              not stack up under one input. */}
          {!fields.password && (
            <p
              className={cn(
                "mt-2 flex items-center gap-1.5 text-xs transition-colors",
                longEnough ? "font-medium text-success" : "text-text-muted"
              )}
            >
              <Check
                className={cn("h-3.5 w-3.5", longEnough ? "opacity-100" : "opacity-40")}
                aria-hidden
              />
              At least {PASSWORD_MIN} characters
            </p>
          )}
        </div>

        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Create account
          {!loading && <ArrowRight className="h-4 w-4" />}
        </Button>

        <p className="text-center text-caption text-text-muted">
          You can add your phone, location and preferences later in Settings.
        </p>
      </form>

      <p className="mt-6 border-t border-border pt-5 text-center text-sm text-text-secondary">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
