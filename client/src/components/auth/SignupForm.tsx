"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";

export function SignupForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => router.push("/dashboard"), 600);
  };

  return (
    <div>
      <h1 className="text-h1 text-text-primary">Create your account</h1>
      <p className="mt-2 text-text-secondary">
        Tell us a little about yourself to start planning.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {/* Photo */}
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-border bg-surface-muted text-text-muted">
            <Camera className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">Profile photo</p>
            <button type="button" className="mt-1 text-sm font-medium text-primary hover:underline">
              Upload a photo
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input name="firstName" label="First name" placeholder="Jane" required />
          <Input name="lastName" label="Last name" placeholder="Traveller" required />
        </div>

        <Input name="username" label="Username" placeholder="jane_travels" required />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input name="email" type="email" label="Email address" placeholder="you@example.com" required />
          <Input name="phone" type="tel" label="Phone number" placeholder="+91 98765 43210" />
        </div>

        <Input name="password" type="password" label="Password" placeholder="Create a password" hint="At least 8 characters." required />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input name="city" label="City" placeholder="Bengaluru" />
          <Input name="country" label="Country" placeholder="India" />
        </div>

        <Textarea name="additional" label="Additional information" placeholder="Anything else you'd like us to know…" rows={3} />

        <Button type="submit" size="lg" className="w-full" loading={loading}>
          {loading ? "Creating account…" : "Register"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-text-secondary">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
