"use client";

import Image from "next/image";
import { useState } from "react";
import { Clock, Plus, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PriceTag } from "@/components/ui/PriceTag";
import { AddToTripDialog } from "./AddToTripDialog";
import { pluralize } from "@/lib/utils/format";
import type { Activity } from "@/types";

export function ActivityCard({ activity }: { activity: Activity }) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-[#c2c2c2]/60 bg-surface shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover">
      {/* Image + badges */}
      <div className="relative h-40 overflow-hidden">
        <Image
          src={activity.imageUrl}
          alt={activity.name}
          fill
          sizes="(max-width: 768px) 100vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span className="absolute left-3 top-3">
          <Badge variant="primary">{activity.category}</Badge>
        </span>
        <span className="absolute bottom-3 right-3 flex items-center gap-1 rounded-md border border-white bg-white px-2 py-0.5 text-[12px] font-semibold text-secondary shadow-sm">
          <Clock className="h-3 w-3" /> {pluralize(activity.durationHours, "hr")}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-h4 leading-tight text-text-primary">{activity.name}</h3>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-text-muted">
          <MapPin className="h-4 w-4 shrink-0" /> {activity.cityName}
        </p>
        <p className="mt-2.5 line-clamp-2 text-sm text-text-secondary">{activity.description}</p>

        {/* Price */}
        <div className="mt-auto border-t border-dashed border-[#e0e0e0] pt-4">
          <PriceTag price={activity.cost} seed={activity.id} unit="per person" currency="USD" discount />
        </div>

        <Button className="mt-4 w-full" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> Add to Trip
        </Button>
      </div>

      {adding && (
        <AddToTripDialog activity={activity} onClose={() => setAdding(false)} />
      )}
    </div>
  );
}
