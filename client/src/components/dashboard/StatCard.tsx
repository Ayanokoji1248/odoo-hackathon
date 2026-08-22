import { type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
  tone?: "primary" | "secondary" | "success" | "info";
}

const tones = {
  primary: "bg-primary-light text-primary-hover",
  secondary: "bg-secondary-light text-secondary",
  success: "bg-green-50 text-success",
  info: "bg-blue-50 text-info",
};

export function StatCard({ label, value, icon: Icon, hint, tone = "primary" }: StatCardProps) {
  return (
    <Card className="flex items-center gap-4">
      <span className={cn("flex h-12 w-12 items-center justify-center rounded-xl", tones[tone])}>
        <Icon className="h-6 w-6" />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-text-secondary">{label}</p>
        <p className="text-h3 text-text-primary">{value}</p>
        {hint && <p className="text-caption text-text-muted">{hint}</p>}
      </div>
    </Card>
  );
}
