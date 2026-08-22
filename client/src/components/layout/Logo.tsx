import Link from "next/link";
import { Globe2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function Logo({ className, href = "/dashboard" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2", className)}>
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-white">
        <Globe2 className="h-5 w-5" />
      </span>
      <span className="font-display text-lg font-extrabold tracking-tight text-secondary">
        Globe<span className="text-primary">Trotter</span>
      </span>
    </Link>
  );
}
