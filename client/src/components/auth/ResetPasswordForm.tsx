"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordField } from "./PasswordField";
import { resetPassword } from "@/lib/api/auth";
import { errorMessages } from "@/lib/api/client";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/api/users";

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  // The token normally arrives in the emailed link. It is also editable below, so
  // a token pasted from the dev shortcut on /forgot-password works too.
  const [token, setToken] = useState(params.get("token") ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const tooShort = password.length > 0 && password.length < PASSWORD_MIN;
  const mismatch = confirm.length > 0 && confirm !== password;

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setErrors([]);
    try {
      await resetPassword(token.trim(), password);
      setDone(true);
    } catch (error) {
      setErrors(errorMessages(error));
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-green-50 text-success">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h1 className="text-h2 text-secondary">Password updated</h1>
        <p className="mt-2 text-text-secondary">
          Every session has been revoked - any device still signed in loses access
          within 15 minutes. Sign in with your new password.
        </p>
        <Button size="lg" className="mt-6 w-full" onClick={() => router.push("/login")}>
          Go to sign in
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-h1 text-secondary">Choose a new password</h1>
        <p className="mt-1.5 text-sm leading-6 text-text-secondary">
          The reset link works once, and saving revokes every signed-in session.
        </p>
      </div>

      {errors.length > 0 && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-2.5 rounded-xl border border-error/25 bg-red-50 p-3.5"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
          <ul className="space-y-0.5 text-sm font-medium text-error">
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Input
          label="Reset token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          leftIcon={<KeyRound className="h-4 w-4" />}
          placeholder="From your reset link"
          required
        />
        <PasswordField
          name="new-password"
          label="New password"
          value={password}
          minLength={PASSWORD_MIN}
          maxLength={PASSWORD_MAX}
          autoComplete="new-password"
          onChange={(e) => setPassword(e.target.value)}
          error={tooShort ? `At least ${PASSWORD_MIN} characters` : undefined}
          hint={`${PASSWORD_MIN}-${PASSWORD_MAX} characters`}
          required
        />
        <PasswordField
          name="confirm-password"
          label="Confirm new password"
          value={confirm}
          autoComplete="new-password"
          onChange={(e) => setConfirm(e.target.value)}
          error={mismatch ? "Does not match" : undefined}
          required
        />

        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={loading}
          disabled={!token.trim() || password.length < PASSWORD_MIN || confirm !== password}
        >
          Set new password
        </Button>
      </form>

      <p className="mt-7 border-t border-border pt-5 text-center text-sm text-text-secondary">
        Link expired?{" "}
        <Link href="/forgot-password" className="font-semibold text-primary hover:underline">
          Request a new one
        </Link>
      </p>
    </div>
  );
}
