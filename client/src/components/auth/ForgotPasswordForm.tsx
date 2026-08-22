"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { forgotPassword } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  // Returned only while the API runs with DEBUG=true - there is no mailer, so
  // without this the reset flow cannot be completed at all. See lib/api/auth.ts.
  const [devToken, setDevToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const { resetToken } = await forgotPassword(email);
      setDevToken(resetToken ?? null);
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to send a reset link");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-green-50 text-success">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h1 className="text-h2 text-secondary">Check your inbox</h1>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          If an account exists for <strong className="text-text-primary">{email}</strong>,
          a reset link is on its way.
        </p>

        {devToken && (
          <div className="mt-6 rounded-xl border border-dashed border-amber-400 bg-amber-50 p-4 text-left">
            <p className="text-sm font-semibold text-amber-900">
              Dev only — no mailer is configured
            </p>
            <p className="mt-1 text-caption text-amber-800">
              The API returns the token directly while <code>DEBUG=true</code>. It
              will not appear in production.
            </p>
            <code className="mt-2 block break-all rounded-lg bg-white/70 p-2 text-caption text-amber-900">
              {devToken}
            </code>
            <Link href={`/reset-password?token=${encodeURIComponent(devToken)}`}>
              <Button size="sm" variant="outline" className="mt-3">
                Continue to reset
              </Button>
            </Link>
          </div>
        )}

        <Link
          href="/login"
          className="mt-7 inline-flex items-center gap-1.5 border-t border-border pt-5 text-sm font-medium text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-h1 text-secondary">Reset your password</h1>
        <p className="mt-1.5 text-sm leading-6 text-text-secondary">
          Enter the email you signed up with and we&apos;ll send you a link.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-2.5 rounded-xl border border-error/25 bg-red-50 p-3.5"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
          <p className="text-sm font-medium text-error">{error}</p>
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Input
          name="email"
          type="email"
          label="Email"
          placeholder="you@example.com"
          autoComplete="email"
          autoCapitalize="off"
          spellCheck={false}
          autoFocus
          leftIcon={<Mail className="h-4 w-4" />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={loading}
          disabled={!email.trim()}
        >
          Send reset link
        </Button>
      </form>

      <div className="mt-7 border-t border-border pt-5 text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
      </div>
    </div>
  );
}
