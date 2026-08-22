"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FilterToolbar } from "@/components/layout/FilterToolbar";
import { tripStatusMeta } from "@/lib/constants/status";
import { formatDateRange } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { Trip } from "@/types";

const COLORS = ["bg-primary", "bg-info", "bg-secondary", "bg-success", "bg-purple-500", "bg-pink-500"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function TripCalendar({ trips }: { trips: Trip[] }) {
  const initial = new Date();
  const [year, setYear] = useState(initial.getFullYear());
  const [month, setMonth] = useState(initial.getMonth());
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("date");

  const colorByTrip = useMemo(() => {
    const map: Record<string, string> = {};
    trips.forEach((t, i) => (map[t.id] = COLORS[i % COLORS.length]));
    return map;
  }, [trips]);

  const visibleTrips = useMemo(
    () =>
      trips
        .filter((t) => (!query || t.name.toLowerCase().includes(query.toLowerCase())) && (status === "all" || t.status === status))
        .sort((a, b) => (sort === "date" ? +new Date(a.startDate) - +new Date(b.startDate) : a.name.localeCompare(b.name))),
    [trips, query, status, sort]
  );

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const tripsOnDay = (day: number) => {
    const date = iso(year, month, day);
    return visibleTrips.filter((t) => date >= t.startDate && date <= t.endDate);
  };

  const shift = (dir: -1 | 1) => {
    let m = month + dir;
    let y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m);
    setYear(y);
  };

  return (
    <div>
      <FilterToolbar
        className="mb-6"
        query={query}
        onQueryChange={setQuery}
        placeholder="Search trips…"
        groupBy={{ value: status, options: [{ label: "All", value: "all" }, { label: "Ongoing", value: "ongoing" }, { label: "Upcoming", value: "upcoming" }, { label: "Completed", value: "completed" }], onChange: setStatus }}
        filterBy={{ value: status, options: [{ label: "All", value: "all" }, { label: "Ongoing", value: "ongoing" }, { label: "Upcoming", value: "upcoming" }, { label: "Completed", value: "completed" }], onChange: setStatus }}
        sortBy={{ value: sort, options: [{ label: "Date", value: "date" }, { label: "Name", value: "name" }], onChange: setSort }}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Calendar grid */}
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-h3 text-text-primary">{MONTHS[month]} {year}</h2>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" onClick={() => shift(-1)} aria-label="Previous month">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => shift(1)} aria-label="Next month">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="pb-2 text-center text-caption font-semibold uppercase text-text-muted">
                {d}
              </div>
            ))}
            {cells.map((day, i) => (
              <div
                key={i}
                className={cn(
                  "min-h-20 rounded-lg border p-1.5",
                  day ? "border-border" : "border-transparent bg-transparent"
                )}
              >
                {day && (
                  <>
                    <span className="text-caption font-medium text-text-secondary">{day}</span>
                    <div className="mt-1 space-y-1">
                      {tripsOnDay(day).slice(0, 3).map((t) => (
                        <Link
                          key={t.id}
                          href={`/trips/${t.id}`}
                          className={cn("block truncate rounded px-1.5 py-0.5 text-caption font-medium text-white", colorByTrip[t.id])}
                          title={t.name}
                        >
                          {t.name}
                        </Link>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Legend / trip list */}
        <aside>
          <h3 className="mb-3 text-h4 text-text-primary">Your Trips</h3>
          <div className="space-y-2">
            {visibleTrips.map((t) => (
              <Link key={t.id} href={`/trips/${t.id}`} className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3 hover:bg-surface-muted">
                <span className={cn("mt-1 h-3 w-3 shrink-0 rounded-full", colorByTrip[t.id])} />
                <div className="min-w-0">
                  <p className="truncate font-medium text-text-primary">{t.name}</p>
                  <p className="text-caption text-text-muted">{formatDateRange(t.startDate, t.endDate)}</p>
                  <Badge variant={tripStatusMeta[t.status].variant} className="mt-1">{tripStatusMeta[t.status].label}</Badge>
                </div>
              </Link>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
