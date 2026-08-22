"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MapPinned } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { FilterToolbar } from "@/components/layout/FilterToolbar";
import { TripCard } from "./TripCard";
import { tripStatusMeta } from "@/lib/constants/status";
import type { Trip, TripStatus } from "@/types";

const STATUS_ORDER: TripStatus[] = ["ongoing", "upcoming", "completed", "draft"];

export function TripsExplorer({ trips }: { trips: Trip[] }) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("status");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("recent");

  const filtered = useMemo(() => {
    return trips
      .filter((t) => {
        const q =
          !query ||
          t.name.toLowerCase().includes(query.toLowerCase()) ||
          t.stops.some((s) => s.cityName.toLowerCase().includes(query.toLowerCase()));
        const f = filter === "all" || t.status === filter;
        return q && f;
      })
      .sort((a, b) =>
        sort === "recent"
          ? +new Date(b.startDate) - +new Date(a.startDate)
          : a.name.localeCompare(b.name)
      );
  }, [trips, query, filter, sort]);

  // Group into sections (by status when group === "status", else a single "All" group).
  const groups: { key: string; label: string; items: Trip[] }[] = useMemo(() => {
    if (group !== "status") return [{ key: "all", label: "All Trips", items: filtered }];
    return STATUS_ORDER.map((s) => ({
      key: s,
      label: tripStatusMeta[s].label,
      items: filtered.filter((t) => t.status === s),
    })).filter((g) => g.items.length > 0);
  }, [filtered, group]);

  return (
    <div>
      <FilterToolbar
        className="mb-6"
        query={query}
        onQueryChange={setQuery}
        placeholder="Search trips or cities…"
        groupBy={{ value: group, options: [{ label: "Status", value: "status" }, { label: "None", value: "none" }], onChange: setGroup }}
        filterBy={{
          value: filter,
          options: [{ label: "All", value: "all" }, { label: "Ongoing", value: "ongoing" }, { label: "Upcoming", value: "upcoming" }, { label: "Completed", value: "completed" }, { label: "Drafts", value: "draft" }],
          onChange: setFilter,
        }}
        sortBy={{ value: sort, options: [{ label: "Most recent", value: "recent" }, { label: "Name", value: "name" }], onChange: setSort }}
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={MapPinned}
          title="No trips here yet"
          description="Start planning your next adventure — it only takes a minute."
          action={
            <Link href="/trips/create">
              <Button>Plan a Trip</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-10">
          {groups.map((g) => (
            <section key={g.key}>
              <div className="mb-4 flex items-center gap-2">
                <h2 className="text-h3 text-text-primary">{g.label}</h2>
                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-text-muted">
                  {g.items.length}
                </span>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {g.items.map((trip) => (
                  <TripCard key={trip.id} trip={trip} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
