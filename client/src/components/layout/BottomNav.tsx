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
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-0.5 py-2.5 text-caption font-medium transition-colors",
              active ? "text-primary" : "text-text-muted"
            )}
          >
            <item.icon className={cn("h-5 w-5", active && "scale-110")} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
