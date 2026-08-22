"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2 } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterToolbar } from "@/components/layout/FilterToolbar";
import { CityCard } from "./CityCard";
import { getSavedCities } from "@/lib/api/cities";
import type { City } from "@/types";

export function CitiesExplorer({ cities }: { cities: City[] }) {
  // Fetched here rather than in the page: /cities is a server component and the
  // session cookie only travels with requests the browser makes.
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("all");
  const [cost, setCost] = useState("all");
  const [sort, setSort] = useState("popularity");

  useEffect(() => {
    getSavedCities()
      .then((rows) => setSavedIds(new Set(rows.map((c) => c.id))))
      .catch(() => setSavedIds(new Set()));
  }, []);

  const regions = useMemo(
    () => ["all", ...Array.from(new Set(cities.map((c) => c.region)))],
    [cities]
  );

  const filtered = useMemo(() => {
    return cities
      .filter((c) => {
        const q =
          !query ||
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.country.toLowerCase().includes(query.toLowerCase());
        const r = region === "all" || c.region === region;
        const co = cost === "all" || c.costIndex === cost;
        return q && r && co;
      })
      .sort((a, b) =>
        sort === "popularity" ? b.popularity - a.popularity : a.avgDailyCost - b.avgDailyCost
      );
  }, [cities, query, region, cost, sort]);

  return (
    <div>
      <FilterToolbar
        className="mb-4"
        query={query}
        onQueryChange={setQuery}
        placeholder="Search cities or countries…"
        groupBy={{ value: region, options: regions.map((r) => ({ label: r === "all" ? "All regions" : r, value: r })), onChange: setRegion }}
        filterBy={{ value: cost, options: [{ label: "Any cost", value: "all" }, { label: "$", value: "$" }, { label: "$$", value: "$$" }, { label: "$$$", value: "$$$" }, { label: "$$$$", value: "$$$$" }], onChange: setCost }}
        sortBy={{ value: sort, options: [{ label: "Popularity", value: "popularity" }, { label: "Lowest cost", value: "cost" }], onChange: setSort }}
      />

      <p className="mb-4 text-sm text-text-secondary">{filtered.length} destinations</p>

      {filtered.length === 0 ? (
        <EmptyState icon={Building2} title="No cities found" description="Try adjusting your filters." />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((city) => (
            <CityCard
              key={city.id}
              city={city}
              saved={savedIds.has(city.id)}
              onToggled={(id, nowSaved) =>
                setSavedIds((prev) => {
                  const next = new Set(prev);
                  if (nowSaved) next.add(id);
                  else next.delete(id);
                  return next;
                })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
