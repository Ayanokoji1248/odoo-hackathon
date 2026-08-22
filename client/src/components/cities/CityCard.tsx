"use client";

import Image from "next/image";
import { Plus, TrendingUp, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PriceTag } from "@/components/ui/PriceTag";
import { useToast } from "@/components/ui/Toast";
import type { City } from "@/types";

export function CityCard({ city }: { city: City }) {
  const { toast } = useToast();
  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-[#c2c2c2]/60 bg-surface shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover">
      {/* Image + badge */}
      <div className="relative h-44 overflow-hidden">
        <Image
          src={city.imageUrl}
          alt={city.name}
          fill
          sizes="(max-width: 768px) 100vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span className="absolute bottom-3 left-3 rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-secondary shadow-sm">
          Best: {city.bestSeason}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-h4 leading-tight text-text-primary">{city.name}</h3>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-text-muted">
          <MapPin className="h-4 w-4 shrink-0" /> {city.country}
        </p>

        <div className="mt-3 flex items-center gap-1.5 text-sm text-text-secondary">
          <TrendingUp className="h-4 w-4 text-success" />
          {city.popularity}% popular · {city.region}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {city.tags.slice(0, 3).map((t) => (
            <Badge key={t}>{t}</Badge>
          ))}
        </div>

        {/* Price */}
        <div className="mt-auto border-t border-dashed border-[#e0e0e0] pt-4">
          <PriceTag price={city.avgDailyCost} seed={city.id} unit="per person" currency="USD" discount />
        </div>

        <Button
          className="mt-4 w-full"
          onClick={() => toast(`${city.name} added to your trip`, "success")}
        >
          <Plus className="h-4 w-4" /> Add to Trip
        </Button>
      </div>
    </div>
  );
}
