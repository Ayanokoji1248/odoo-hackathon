"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Plus, User, Settings, LogOut, Menu, X, Shield, ChevronDown } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { Logo } from "./Logo";
import { topNav, type NavItem } from "@/lib/constants/navigation";
import { mockUser } from "@/data/mock/users";
import { cn } from "@/lib/utils/cn";

function isActive(pathname: string, item: NavItem): boolean {
  if (item.href) {
    if (item.href === "/dashboard") return pathname === "/dashboard";
    return pathname === item.href || pathname.startsWith(item.href + "/");
  }
  return (item.children ?? []).some(
    (c) => pathname === c.href || pathname.startsWith(c.href + "/")
  );
}

/** A single desktop menu entry — a link, or a hover dropdown when it has children. */
function MenuEntry({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item);
  const Icon = item.icon;
  // Stacked: label on top, filled icon below.
  const base = cn(
    "flex flex-col items-center gap-1 px-4 py-1 text-[13px] font-semibold transition-colors",
    active ? "text-primary" : "text-text-secondary hover:text-primary"
  );

  if (!item.children) {
    return (
      <Link href={item.href!} className={base}>
        <Icon className="h-5 w-5" strokeWidth={2} />
        <span>{item.label}</span>
      </Link>
    );
  }

  return (
    <div className="group relative">
      <button className={base}>
        <Icon className="h-5 w-5" strokeWidth={2} />
        <span className="flex items-center gap-0.5">
          {item.label}
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-hover:rotate-180" />
        </span>
      </button>
      {/* Hover dropdown */}
      <div className="invisible absolute left-0 top-full z-50 min-w-56 pt-2 opacity-0 transition-all group-hover:visible group-hover:opacity-100">
        <div className="overflow-hidden rounded-xl border border-border bg-surface p-1.5 shadow-pop">
          {item.children.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-muted"
            >
              {c.icon && (
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary-hover">
                  <c.icon className="h-4 w-4" />
                </span>
              )}
              <span>
                <span className="block text-sm font-medium text-text-primary">{c.label}</span>
                {c.description && (
                  <span className="block text-caption text-text-muted">{c.description}</span>
                )}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 lg:px-8">
        <Logo />

        {/* Desktop text menu */}
        <nav className="hidden items-center lg:flex">
          {topNav.map((item) => (
            <MenuEntry key={item.label} item={item} pathname={pathname} />
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" className="hidden sm:inline-flex" onClick={() => router.push("/trips/create")}>
            <Plus className="h-4 w-4" /> Plan a trip
          </Button>

          <button aria-label="Notifications" className="relative rounded-lg p-2 text-text-secondary hover:bg-surface-muted">
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary ring-2 ring-surface" />
          </button>

          <Dropdown trigger={<Avatar name={mockUser.name} src={mockUser.avatarUrl} size="sm" />}>
            <div className="border-b border-border px-3 py-2.5">
              <p className="text-sm font-semibold text-text-primary">{mockUser.name}</p>
              <p className="truncate text-xs text-text-muted">{mockUser.email}</p>
            </div>
            <div className="pt-1">
              <Link href="/profile"><DropdownItem><User className="h-4 w-4" /> Profile</DropdownItem></Link>
              <Link href="/settings"><DropdownItem><Settings className="h-4 w-4" /> Settings</DropdownItem></Link>
              <Link href="/admin"><DropdownItem><Shield className="h-4 w-4" /> Admin Panel</DropdownItem></Link>
              <Link href="/login"><DropdownItem danger><LogOut className="h-4 w-4" /> Logout</DropdownItem></Link>
            </div>
          </Dropdown>

          <button
            aria-label="Menu"
            onClick={() => setOpen((o) => !o)}
            className="rounded-lg p-2 text-text-secondary hover:bg-surface-muted lg:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown nav */}
      {open && (
        <nav className="border-t border-border bg-surface px-4 py-2 lg:hidden">
          {topNav.map((item) =>
            item.children ? (
              <div key={item.label} className="py-1">
                <p className="px-3 py-1.5 text-caption font-semibold uppercase tracking-wider text-text-muted">
                  {item.label}
                </p>
                {item.children.map((c) => (
                  <Link
                    key={c.href}
                    href={c.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-text-secondary"
                  >
                    {c.icon && <c.icon className="h-4 w-4" />} {c.label}
                  </Link>
                ))}
              </div>
            ) : (
              <Link
                key={item.label}
                href={item.href!}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                  isActive(pathname, item) ? "bg-primary-light text-primary-hover" : "text-text-secondary"
                )}
              >
                <item.icon className="h-4 w-4" /> {item.label}
              </Link>
            )
          )}
        </nav>
      )}
    </header>
  );
}
