import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-light text-primary-hover">
        <Compass className="h-8 w-8" />
      </div>
      <p className="text-h1 font-bold text-text-primary">404</p>
      <h1 className="mt-1 text-h3 text-text-primary">This route doesn&apos;t exist</h1>
      <p className="mt-2 max-w-sm text-text-secondary">
        The page you&apos;re looking for may have been moved, or the trip has ended.
      </p>
      <Link href="/dashboard" className="mt-6">
        <Button>Back to Dashboard</Button>
      </Link>
    </div>
  );
}
