import Link from "next/link";
import { type ReactNode } from "react";
import { Logo } from "@/components/layout/Logo";

interface AuthShellProps {
  children: ReactNode;
}

/**
 * One centred column, no photography.
 *
 * Signing in is a single-task screen, so it gets a single-task layout: the form is
 * the only thing on the page, centred on the axis the eye already scans. The old
 * split panel spent half the viewport on a stock photo that competed with the
 * fields for attention and pushed the form off-centre - and it cost two 1200px+
 * image downloads before anyone could type.
 *
 * The depth here is CSS only, built from the design tokens: two soft brand-tinted
 * washes and a faint dot grid that fades out downward. Nothing to load, nothing to
 * go stale, and it recolours automatically if the palette changes.
 */
export function AuthShell({ children }: AuthShellProps) {
  return (
    <main className="relative isolate grid min-h-dvh place-items-center overflow-hidden bg-background px-4 py-10 sm:px-6">
      {/* Decorative only - hidden from the accessibility tree. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(46rem_26rem_at_50%_-4rem,var(--color-secondary-light),transparent_72%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -z-10 right-[-8rem] bottom-[-10rem] h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,var(--color-primary-light),transparent_68%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[30rem] bg-[radial-gradient(var(--color-border)_1px,transparent_1px)] [background-size:20px_20px] [mask-image:radial-gradient(32rem_20rem_at_50%_2rem,black,transparent)]"
      />

      {/* One width for every auth screen: login and sign-up sit at the same
          optical centre, so moving between them does not resize the card. */}
      <div className="mx-auto flex w-full max-w-md flex-col items-center">
        <Logo href="/" size="lg" className="mb-6" />

        <div className="motion-safe:animate-fade-in w-full rounded-3xl border border-border bg-surface p-6 shadow-[0_1px_2px_rgba(4,46,66,0.04),0_12px_32px_-8px_rgba(4,46,66,0.12)] sm:p-8">
          {children}
        </div>

        <p className="mt-6 max-w-sm text-balance text-center text-caption text-text-muted">
          Plan trips, price them honestly, and share the ones worth sharing.
        </p>
        <Link
          href="/"
          className="mt-2 rounded-md px-2 py-1 text-caption font-medium text-text-muted transition-colors hover:text-text-primary"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
