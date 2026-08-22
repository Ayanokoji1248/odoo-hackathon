"use client";

import Image from "next/image";
import { useState } from "react";
import { Bookmark, BookmarkCheck, TrendingUp, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PriceTag } from "@/components/ui/PriceTag";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api/client";
import { saveCity, unsaveCity } from "@/lib/api/cities";
import type { City } from "@/types";

export function CityCard({
  city,
  saved = false,
  onToggled,
}: {
  city: City;
  saved?: boolean;
  /** Told the new state after a successful toggle, so a list can drop the card. */
  onToggled?: (cityId: string, nowSaved: boolean) => void;
}) {
  const { toast } = useToast();
  // `saved` is the truth; `pending` is only the optimistic override while a
  // request is in flight. Copying the prop into state instead would freeze the
  // card at whatever it was on first render - and on /cities that is *before*
  // the saved list has loaded, so every city would read "Save".
  const [pending, setPending] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const on = pending ?? saved;

  const toggle = async () => {
    if (busy) return;
    const next = !on;
    setPending(next);
    setBusy(true);
    try {
      if (next) await saveCity(city.id);
      else await unsaveCity(city.id);
      toast(next ? `${city.name} saved` : `${city.name} removed`, next ? "success" : "info");
      onToggled?.(city.id, next);
      // Hand control back to the prop, which the parent has just updated.
      setPending(null);
    } catch (error) {
      setPending(null);
      const status = error instanceof ApiError ? error.status : 0;
      // Already in the state the user asked for. Reachable whenever this card's
      // `saved` prop is stale - a second tab, or a saved-list fetch that failed
      // and left every city reading "Save". Telling them it went wrong would be
      // false: the row is exactly where they wanted it.
      if ((next && status === 409) || (!next && status === 404)) {
        onToggled?.(city.id, next);
        return;
      }
      toast(
        status === 401
          ? "Sign in to save destinations"
          : `Could not ${next ? "save" : "remove"} ${city.name}`,
        "error"
      );
    } finally {
      setBusy(false);
    }
  };

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
          variant={on ? "outline" : "primary"}
          onClick={toggle}
          disabled={busy}
          aria-pressed={on}
        >
          {on ? (
            <>
              <BookmarkCheck className="h-4 w-4" /> Saved
            </>
          ) : (
            <>
              <Bookmark className="h-4 w-4" /> Save
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
