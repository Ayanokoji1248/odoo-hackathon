"use client";

import { useMemo, useState } from "react";
import { Compass } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterToolbar } from "@/components/layout/FilterToolbar";
import { ActivityCard } from "./ActivityCard";
import type { Activity } from "@/types";

export function ActivitiesExplorer({ activities }: { activities: Activity[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [city, setCity] = useState("all");
  const [sort, setSort] = useState("rating");

  const categories = useMemo(() => ["all", ...Array.from(new Set(activities.map((a) => a.category)))], [activities]);
  const cities = useMemo(() => ["all", ...Array.from(new Set(activities.map((a) => a.cityName)))], [activities]);

  const filtered = useMemo(() => {
    return activities
      .filter((a) => {
        const q = !query || a.name.toLowerCase().includes(query.toLowerCase()) || a.cityName.toLowerCase().includes(query.toLowerCase());
        const c = category === "all" || a.category === category;
        const ci = city === "all" || a.cityName === city;
        return q && c && ci;
      })
      .sort((a, b) => (sort === "rating" ? b.rating - a.rating : a.cost - b.cost));
  }, [activities, query, category, city, sort]);

  return (
    <div>
      <FilterToolbar
        className="mb-4"
        query={query}
        onQueryChange={setQuery}
        placeholder="Search activities…"
        groupBy={{ value: category, options: categories.map((c) => ({ label: c === "all" ? "All categories" : c, value: c })), onChange: setCategory }}
        filterBy={{ value: city, options: cities.map((c) => ({ label: c === "all" ? "All cities" : c, value: c })), onChange: setCity }}
        sortBy={{ value: sort, options: [{ label: "Rating", value: "rating" }, { label: "Price", value: "price" }], onChange: setSort }}
      />

      <p className="mb-4 text-sm text-text-secondary">{filtered.length} results</p>

      {filtered.length === 0 ? (
        <EmptyState icon={Compass} title="No activities found" description="Try a different category or search." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((a) => (
            <ActivityCard key={a.id} activity={a} />
          ))}
        </div>
      )}
    </div>
  );
}
