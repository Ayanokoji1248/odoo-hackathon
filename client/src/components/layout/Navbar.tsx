"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Plus, User, Settings, LogOut, Menu, X, Shield } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { Logo } from "./Logo";
import { topNav } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils/cn";
import { useAuth, useUser } from "@/lib/auth/AuthProvider";

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Non-null: <RequireAuth> in the layout does not render us until it resolves.
  const user = useUser();
  const { logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 lg:px-8">
        <Logo />

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 lg:flex">
          {topNav.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary-light text-primary-hover"
                    : "text-text-secondary hover:bg-surface-muted hover:text-text-primary"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" className="hidden sm:inline-flex" onClick={() => router.push("/trips/create")}>
            <Plus className="h-4 w-4" /> Plan a trip
          </Button>

          <button aria-label="Notifications" className="relative rounded-lg p-2 text-text-secondary hover:bg-surface-muted">
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary ring-2 ring-surface" />
          </button>

          <Dropdown trigger={<Avatar name={user.name} src={user.avatarUrl} size="sm" />}>
            <div className="border-b border-border px-3 py-2.5">
              <p className="text-sm font-semibold text-text-primary">{user.name}</p>
              <p className="truncate text-xs text-text-muted">{user.email}</p>
            </div>
            <div className="pt-1">
              <Link href="/profile"><DropdownItem><User className="h-4 w-4" /> Profile</DropdownItem></Link>
              <Link href="/settings"><DropdownItem><Settings className="h-4 w-4" /> Settings</DropdownItem></Link>
              {/* Cosmetic gate only — /admin enforces the role itself, and the
                  API is the boundary that actually matters. */}
              {user.role === "admin" && (
                <Link href="/admin"><DropdownItem><Shield className="h-4 w-4" /> Admin Panel</DropdownItem></Link>
              )}
              <DropdownItem danger onClick={logout}><LogOut className="h-4 w-4" /> Logout</DropdownItem>
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
          {topNav.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                  active ? "bg-primary-light text-primary-hover" : "text-text-secondary"
                )}
              >
                <item.icon className="h-4 w-4" /> {item.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
