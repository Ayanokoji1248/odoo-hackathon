import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type Variant =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "outline";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

const variants: Record<Variant, string> = {
  default: "bg-surface-muted text-text-secondary",
  primary: "bg-primary-light text-primary-hover",
  success: "bg-green-50 text-success",
  warning: "bg-amber-50 text-amber-700",
  error: "bg-red-50 text-error",
  info: "bg-blue-50 text-info",
  outline: "border border-border text-text-secondary",
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
