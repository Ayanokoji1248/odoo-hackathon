"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2 } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterToolbar } from "@/components/layout/FilterToolbar";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { BannerSlider } from "@/components/dashboard/BannerSlider";
import { CityCard } from "@/components/cities/CityCard";
import { TripCard } from "@/components/trips/TripCard";
import type { City, Trip } from "@/types";

interface Props {
  name: string;
  cities: City[];
  previousTrips: Trip[];
}

export function DashboardLanding({ name, cities, previousTrips }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const [cost, setCost] = useState("all");
  const [sort, setSort] = useState("popularity");
  const firstName = name.split(" ")[0];

  const regions = useMemo(() => ["all", ...Array.from(new Set(cities.map((c) => c.region)))], [cities]);

  const filtered = useMemo(() => {
    return cities
      .filter((c) => {
        const q = !query || c.name.toLowerCase().includes(query.toLowerCase()) || c.country.toLowerCase().includes(query.toLowerCase());
        const g = group === "all" || c.region === group;
        const co = cost === "all" || c.costIndex === cost;
        return q && g && co;
      })
      .sort((a, b) => (sort === "popularity" ? b.popularity - a.popularity : a.avgDailyCost - b.avgDailyCost))
      .slice(0, 8);
  }, [cities, query, group, cost, sort]);

  return (
    <div>
      {/* Full-width banner slider (breaks out of the page container) */}
      <div className="relative left-1/2 mb-8 w-screen -translate-x-1/2">
        <BannerSlider firstName={firstName} />
      </div>

      {/* Toolbar */}
      <FilterToolbar
        className="mb-6"
        query={query}
        onQueryChange={setQuery}
        placeholder="Search destinations, cities, countries…"
        groupBy={{ value: group, options: regions.map((r) => ({ label: r === "all" ? "All regions" : r, value: r })), onChange: setGroup }}
        filterBy={{ value: cost, options: [{ label: "Any", value: "all" }, { label: "$", value: "$" }, { label: "$$", value: "$$" }, { label: "$$$", value: "$$$" }, { label: "$$$$", value: "$$$$" }], onChange: setCost }}
        sortBy={{ value: sort, options: [{ label: "Popularity", value: "popularity" }, { label: "Cost", value: "cost" }], onChange: setSort }}
      />

      {/* Top Regional Selections */}
      <section className="mb-10">
        <SectionHeading title="Top Regional Selections" href="/cities" />
        {filtered.length === 0 ? (
          <EmptyState icon={Building2} title="No destinations match" description="Try clearing your filters." />
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {filtered.map((city) => (
              <CityCard key={city.id} city={city} />
            ))}
          </div>
        )}
      </section>

      {/* Previous Trips */}
      <section>
        <SectionHeading title="Previous Trips" href="/trips" />
        {previousTrips.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-text-secondary">
            No previous trips yet.{" "}
            <button onClick={() => router.push("/trips/create")} className="font-medium text-primary hover:underline">
              Plan your first one <ArrowRight className="inline h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {previousTrips.map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
