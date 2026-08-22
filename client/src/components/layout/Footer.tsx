import Link from "next/link";
import { Logo } from "./Logo";

const links = [
  { label: "About", href: "/dashboard" },
  { label: "Explore", href: "/cities" },
  { label: "Community", href: "/community" },
  { label: "Privacy", href: "/settings" },
  { label: "Terms", href: "/settings" },
];

export function Footer() {
  return (
    <footer className="mb-16 border-t border-border bg-surface lg:mb-0">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 sm:flex-row lg:px-8">
        <Logo size="sm" />
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {links.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="text-sm text-text-secondary transition-colors hover:text-primary"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <p className="text-sm text-text-muted">
          © {2026} GlobeTrotter. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
