"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, MapPin, ArrowRight } from "lucide-react";
import type { City } from "@/types";

export function DestinationBanner({ cities }: { cities: City[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const tiles = [...cities].sort((a, b) => b.popularity - a.popularity).slice(0, 10);

  const scroll = (dir: -1 | 1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <section className="bg-secondary-light/50">
      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
        {/* Heading */}
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-h2 text-secondary">Explore top destinations</h2>
            <p className="mt-1 text-text-secondary">Handpicked places travellers love right now.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/cities" className="hidden items-center gap-1 text-sm font-semibold text-primary hover:underline sm:flex">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
            <div className="hidden gap-1 lg:flex">
              <button onClick={() => scroll(-1)} aria-label="Scroll left" className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-text-secondary shadow-sm transition-colors hover:text-primary">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button onClick={() => scroll(1)} aria-label="Scroll right" className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-text-secondary shadow-sm transition-colors hover:text-primary">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Tiles strip */}
        <div ref={ref} className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tiles.map((city) => (
            <Link key={city.id} href="/cities" className="group relative h-64 w-48 shrink-0 snap-start overflow-hidden rounded-2xl shadow-card">
              <Image src={city.imageUrl} alt={city.name} fill sizes="192px" className="object-cover transition-transform duration-500 group-hover:scale-110" />
              <div className="absolute inset-0 bg-linear-to-t from-slate-900/85 via-slate-900/10 to-transparent" />
              <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-bold text-secondary">{city.popularity}%</span>
              <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                <h3 className="font-display text-base font-bold leading-tight">{city.name}</h3>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-white/85">
                  <MapPin className="h-3 w-3 shrink-0" /> {city.country}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
