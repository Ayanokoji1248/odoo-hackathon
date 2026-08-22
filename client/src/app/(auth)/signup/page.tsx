import { AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/auth/SignupForm";

export default function SignupPage() {
  return (
    <AuthShell
      quote="Travel is the only thing you buy that makes you richer."
      author="Anonymous"
    >
      <SignupForm />
    </AuthShell>
  );
}
