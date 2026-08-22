import type { TripStatus } from "@/types";

type BadgeVariant = "primary" | "success" | "warning" | "info" | "default";

export const tripStatusMeta: Record<
  TripStatus,
  { label: string; variant: BadgeVariant }
> = {
  upcoming: { label: "Upcoming", variant: "info" },
  ongoing: { label: "Ongoing", variant: "success" },
  completed: { label: "Completed", variant: "default" },
  draft: { label: "Draft", variant: "warning" },
};
