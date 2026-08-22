"use client";

import { useState } from "react";
import { Mail, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSent(true);
    }, 700);
  };

  if (sent) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-50 text-success">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h1 className="text-h2 text-text-primary">Check your inbox</h1>
        <p className="mt-2 text-text-secondary">
          We&apos;ve sent a password reset link to your email address.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-h1 text-text-primary">Reset password</h1>
      <p className="mt-2 text-text-secondary">
        Enter your email and we&apos;ll send you a reset link.
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <Input
          name="email"
          type="email"
          label="Email"
          placeholder="you@example.com"
          leftIcon={<Mail className="h-4 w-4" />}
          required
        />
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Send reset link
        </Button>
      </form>
    </div>
  );
}
