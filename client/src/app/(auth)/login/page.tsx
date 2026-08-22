import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <AuthShell>
      {/* LoginForm reads ?next= to send people back where they were bounced from,
          and useSearchParams needs a boundary or the whole route drops out of
          static rendering. */}
      <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-black/5" />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
