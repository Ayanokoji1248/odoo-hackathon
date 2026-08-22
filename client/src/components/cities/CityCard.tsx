"use client";

import Image from "next/image";
import { Plus, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { City } from "@/types";

export function CityCard({ city }: { city: City }) {
  const { toast } = useToast();
  return (
    <div className="group overflow-hidden rounded-2xl border border-border bg-surface shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover">
      <div className="relative h-40 overflow-hidden">
        <Image
          src={city.imageUrl}
          alt={city.name}
          fill
          sizes="(max-width: 768px) 100vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-linear-to-t from-slate-900/60 to-transparent" />
        <div className="absolute bottom-3 left-3 text-white">
          <h3 className="text-h4 font-bold">{city.name}</h3>
          <p className="text-sm text-white/85">{city.country}</p>
        </div>
        <div className="absolute right-3 top-3">
          <Badge variant="outline" className="border-white/40 bg-black/30 text-white">
            {city.costIndex}
          </Badge>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1 text-text-secondary">
            <TrendingUp className="h-3.5 w-3.5 text-success" />
            {city.popularity}% popular
          </span>
          <span className="text-text-muted">{city.bestSeason}</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {city.tags.slice(0, 3).map((t) => (
            <Badge key={t}>{t}</Badge>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="mt-4 w-full"
          onClick={() => toast(`${city.name} added to your trip`, "success")}
        >
          <Plus className="h-4 w-4" /> Add to Trip
        </Button>
      </div>
    </div>
  );
}
