import Image from "next/image";
import Link from "next/link";
import { Globe2 } from "lucide-react";
import { type ReactNode } from "react";
import { Logo } from "@/components/layout/Logo";

interface AuthShellProps {
  children: ReactNode;
  quote?: string;
  author?: string;
}

export function AuthShell({
  children,
  quote = "The world is a book, and those who do not travel read only one page.",
  author = "Saint Augustine",
}: AuthShellProps) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Visual side */}
      <div className="relative hidden lg:block">
        <Image
          src="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1200&q=80"
          alt="Mountain landscape"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-t from-slate-900/80 via-slate-900/30 to-slate-900/40" />
        <Link href="/login" className="absolute left-10 top-10 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur">
            <Globe2 className="h-5 w-5" />
          </span>
          <span className="text-lg font-extrabold tracking-tight text-white">GlobeTrotter</span>
        </Link>
        <div className="absolute bottom-12 left-10 right-10 text-white">
          <p className="text-2xl font-semibold leading-snug">“{quote}”</p>
          <p className="mt-3 text-white/70">— {author}</p>
        </div>
      </div>

      {/* Form side */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo href="/login" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
