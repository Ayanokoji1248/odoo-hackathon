import Link from "next/link";
import { Globe2, ArrowLeft } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { mockAdmin } from "@/data/mock/users";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-surface px-5 lg:px-10">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
              <Globe2 className="h-4 w-4" />
            </span>
            <span className="font-extrabold tracking-tight text-text-primary">
              GlobeTrotter <span className="font-medium text-text-muted">Admin</span>
            </span>
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
