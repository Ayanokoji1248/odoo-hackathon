"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { register } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

export function SignupForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const field = (key: string) => String(form.get(key) ?? "").trim();

    try {
      await register({
        firstName: field("firstName"),
        lastName: field("lastName"),
        email: field("email"),
        password: String(form.get("password") ?? ""),
        phone: field("phone"),
        city: field("city"),
        country: field("country"),
        additionalInfo: field("additional"),
      });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to create account");
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="text-center md:text-left">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary sm:text-sm">
          Start planning
        </p>
        <h1 className="mt-2 text-balance font-display text-3xl font-extrabold leading-tight text-secondary sm:text-4xl">
          Create your account
        </h1>
        <p className="mt-2 text-pretty text-sm leading-6 text-text-secondary sm:text-base">
          Tell us a little about yourself to start planning.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-5 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input name="firstName" label="First name" placeholder="Jane" required />
          <Input name="lastName" label="Last name" placeholder="Traveller" required />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Input name="email" type="email" label="Email address" placeholder="you@example.com" required />
          <Input name="phone" type="tel" label="Phone number" placeholder="+91 98765 43210" />
        </div>

        <Input
          name="password"
          type="password"
          label="Password"
          placeholder="Create a password"
          hint="At least 8 characters."
          required
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Input name="city" label="City" placeholder="Bengaluru" />
          <Input name="country" label="Country" placeholder="India" />
        </div>

        <Textarea
          name="additional"
          label="Additional information"
          placeholder="Anything else to know..."
          rows={2}
          className="min-h-16 resize-none"
        />
        {error && (
          <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-error ring-1 ring-red-100">
            {error}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          className="w-full rounded-xl shadow-[0_14px_28px_rgba(199,0,50,0.2)]"
          loading={loading}
        >
          {loading ? "Creating account..." : "Register"}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-text-secondary">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
