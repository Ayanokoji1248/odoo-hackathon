"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TripCard } from "./TripCard";
import type { Trip } from "@/types";

export function TripSlider({ trips }: { trips: Trip[] }) {
  const ref = useRef<HTMLDivElement>(null);

  const scroll = (dir: -1 | 1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <div className="group/slider relative">
      <div
        ref={ref}
        className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {trips.map((trip) => (
          <div key={trip.id} className="w-[300px] shrink-0 snap-start sm:w-[320px]">
            <TripCard trip={trip} />
          </div>
        ))}
      </div>

      {/* Arrows (desktop) */}
      <button
        onClick={() => scroll(-1)}
        aria-label="Scroll left"
        className="absolute -left-4 top-[38%] hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface text-text-secondary shadow-pop transition-colors hover:text-primary lg:flex"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        onClick={() => scroll(1)}
        aria-label="Scroll right"
        className="absolute -right-4 top-[38%] hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface text-text-secondary shadow-pop transition-colors hover:text-primary lg:flex"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
