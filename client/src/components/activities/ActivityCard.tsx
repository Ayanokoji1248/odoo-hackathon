"use client";

import Image from "next/image";
import { Clock, Plus, Star, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, pluralize } from "@/lib/utils/format";
import type { Activity } from "@/types";

export function ActivityCard({ activity }: { activity: Activity }) {
  const { toast } = useToast();
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover">
      <div className="relative h-40 overflow-hidden">
        <Image
          src={activity.imageUrl}
          alt={activity.name}
          fill
          sizes="(max-width: 768px) 100vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute left-3 top-3">
          <Badge variant="primary">{activity.category}</Badge>
        </div>
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-xs font-medium text-white">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          {activity.rating}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-h4 text-text-primary">{activity.name}</h3>
        <p className="mt-0.5 flex items-center gap-1 text-sm text-text-muted">
          <MapPin className="h-3.5 w-3.5" /> {activity.cityName}
        </p>
        <p className="mt-2 line-clamp-2 flex-1 text-sm text-text-secondary">
          {activity.description}
        </p>

        <div className="mt-3 flex items-center justify-between text-sm text-text-secondary">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {pluralize(activity.durationHours, "hour")}
          </span>
          <span className="font-extrabold text-secondary">
            {activity.cost === 0 ? "Free" : formatCurrency(activity.cost)}
          </span>
        </div>

        <Button
          size="sm"
          className="mt-4 w-full"
          onClick={() => toast(`"${activity.name}" added to itinerary`, "success")}
        >
          <Plus className="h-4 w-4" /> Add Activity
        </Button>
      </div>
    </div>
  );
}
