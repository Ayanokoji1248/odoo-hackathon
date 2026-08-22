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
    <main className="relative isolate flex h-dvh items-center justify-center overflow-hidden bg-[#eef3f1] px-3 py-3 sm:px-5 sm:py-5 lg:px-8 lg:py-7">
      <Image
        src="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1920&q=80"
        alt="Mountain road beside a blue lake"
        fill
        priority
        className="-z-30 object-cover"
      />
      <div className="absolute inset-0 -z-20 bg-[linear-gradient(105deg,rgba(2,25,35,0.9)_0%,rgba(4,46,66,0.78)_46%,rgba(255,255,255,0.28)_100%)]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.18),transparent_30%),radial-gradient(circle_at_82%_82%,rgba(199,0,50,0.16),transparent_28%)]" />

      <div
        className={cn(
          "grid h-full max-h-[52rem] w-full max-w-6xl overflow-hidden rounded-[1.35rem] bg-white/96 shadow-[0_24px_80px_rgba(2,25,35,0.28)] ring-1 ring-white/55 backdrop-blur md:grid-cols-[0.86fr_1.14fr] lg:rounded-[1.75rem]",
          wide && "max-w-7xl md:grid-cols-[0.8fr_1.2fr]"
        )}
      >
        <section className="relative hidden min-h-0 flex-col justify-between overflow-hidden bg-secondary p-7 text-white md:flex lg:p-9">
          <Image
            src="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80"
            alt="Traveler looking across a mountain valley"
            fill
            sizes="(min-width: 768px) 45vw, 100vw"
            className="object-cover opacity-72"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,46,66,0.34),rgba(4,46,66,0.92))]" />
          <div className="relative">
            <Logo href="/login" size="lg" tone="light" />
          </div>
          <div className="relative max-w-sm pb-1">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">
              Trip planning workspace
            </p>
            <h2 className="mt-3 text-balance font-display text-4xl font-extrabold leading-[1.05] text-white">
              Your next route is waiting.
            </h2>
            <p className="mt-3 text-pretty text-base leading-7 text-white/78">
              Sign in to organize itineraries, saved cities, shared plans, and trip budgets from one calm place.
            </p>
          </div>
        </section>
        <section className="flex min-h-0 items-center justify-center px-5 py-5 sm:px-8 lg:px-11">
          <div className={cn("w-full", wide ? "max-w-3xl" : "max-w-[27rem]")}>
            <div className="mb-5 flex justify-center md:hidden">
              <Logo href="/login" size="lg" />
            </div>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
