import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default function ResetPasswordPage() {
  // useSearchParams needs a Suspense boundary, or the whole route opts out of
  // static rendering and the build says so.
  return (
    <AuthShell>
      <Suspense fallback={<div className="h-72 animate-pulse rounded-2xl bg-black/5" />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
