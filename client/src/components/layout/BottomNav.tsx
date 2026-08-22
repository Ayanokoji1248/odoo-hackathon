"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { bottomNav } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils/cn";

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
      {bottomNav.map((item) => {
        const href = item.href ?? "/dashboard";
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center gap-0.5 py-2.5 text-caption font-semibold transition-colors",
              active ? "text-primary" : "text-text-muted"
            )}
          >
            <item.icon
              className={cn("h-6 w-6", active && "scale-110")}
              strokeWidth={active ? 2.75 : 2.25}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
