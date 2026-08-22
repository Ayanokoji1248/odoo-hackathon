import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <AuthShell quote="Not all those who wander are lost." author="J.R.R. Tolkien">
      <ForgotPasswordForm />
      <p className="mt-8 text-center text-sm text-text-secondary">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Back to login
        </Link>
      </p>
    </AuthShell>
  );
}
