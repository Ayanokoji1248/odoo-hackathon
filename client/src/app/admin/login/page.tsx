import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { Logo } from "@/components/layout/Logo";

/**
 * Outside the (panel) route group on purpose: that group's layout requires an
 * admin session, so a login screen inside it would redirect to itself.
 */
export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-slate-900 px-5 py-12">
      <Logo href="/" size="sm" tone="light" />
      <AdminLoginForm />
    </div>
  );
}
