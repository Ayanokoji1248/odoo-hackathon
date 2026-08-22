import Image from "next/image";
import { type ReactNode } from "react";
import { Logo } from "@/components/layout/Logo";
import { cn } from "@/lib/utils/cn";

interface AuthShellProps {
  children: ReactNode;
  wide?: boolean;
}

export function AuthShell({ children, wide = false }: AuthShellProps) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-10">
      {/* Full-page background image */}
      <Image
        src="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1920&q=80"
        alt=""
        fill
        priority
        className="-z-20 object-cover"
      />
      {/* Overlay for contrast */}
      <div className="absolute inset-0 -z-10 bg-secondary/70" />

      <div
        className={cn(
          "w-full rounded-2xl border border-primary/30 bg-surface p-6 shadow-pop ring-1 ring-primary/10 sm:p-8",
          wide ? "max-w-2xl" : "max-w-md"
        )}
      >
        <div className="mb-6 flex justify-center">
          <Logo href="/login" size="lg" />
        </div>
        {children}
      </div>
    </div>
  );
}
