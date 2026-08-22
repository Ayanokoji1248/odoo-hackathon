"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Compass } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const tabs = [
  { label: "Cities", href: "/cities", icon: Building2 },
  { label: "Activities", href: "/activities", icon: Compass },
];

export function ExploreTabs() {
  const pathname = usePathname();
  return (
    <div className="mb-6 inline-flex rounded-xl border border-border bg-surface p-1">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              active ? "bg-primary text-white" : "text-text-secondary hover:text-text-primary"
            )}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </Link>
        );
      })}
    </div>
  );
}
