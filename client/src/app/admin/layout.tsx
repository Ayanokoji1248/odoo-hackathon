import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Logo } from "@/components/layout/Logo";
import { mockAdmin } from "@/data/mock/users";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-surface px-5 lg:px-10">
        <div className="flex items-center gap-2.5">
          <Logo href="/admin" size="sm" />
          <span className="rounded-md bg-secondary-light px-2 py-0.5 text-xs font-semibold text-secondary">
            Admin
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-text-primary">
            <ArrowLeft className="h-4 w-4" /> Back to app
          </Link>
          <Avatar name={mockAdmin.name} size="sm" />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-8 lg:px-10">{children}</main>
    </div>
  );
}
