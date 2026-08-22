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
  const todayIso = iso(initial.getFullYear(), initial.getMonth(), initial.getDate());

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
  const total = firstDay + daysInMonth;
  const rows = Math.ceil(total / 7);
  const cells: (number | null)[] = Array.from({ length: rows * 7 }, (_, i) => {
    const day = i - firstDay + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });

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

  const goToday = () => {
    setYear(initial.getFullYear());
    setMonth(initial.getMonth());
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

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* Calendar */}
        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 className="text-h3 text-text-primary">
              {MONTHS[month]} <span className="text-text-muted">{year}</span>
            </h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
              <Button variant="outline" size="icon" onClick={() => shift(-1)} aria-label="Previous month">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => shift(1)} aria-label="Next month">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Weekday row */}
          <div className="grid grid-cols-7 border-b border-border bg-surface-muted/60">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2.5 text-center text-caption font-semibold uppercase tracking-wider text-text-muted">
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              const isToday = day !== null && iso(year, month, day) === todayIso;
              const dayTrips = day ? tripsOnDay(day) : [];
              return (
                <div
                  key={i}
                  className={cn(
                    "min-h-[110px] border-b border-r border-border p-1.5 [&:nth-child(7n)]:border-r-0",
                    !day && "bg-surface-muted/30",
                    i >= cells.length - 7 && "border-b-0"
                  )}
                >
                  {day && (
                    <>
                      <div className="mb-1 flex justify-end">
                        <span
                          className={cn(
                            "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                            isToday ? "bg-primary text-white" : "text-text-secondary"
                          )}
                        >
                          {day}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {dayTrips.slice(0, 3).map((t) => (
                          <Link
                            key={t.id}
                            href={`/trips/${t.id}`}
                            className={cn("block truncate rounded px-1.5 py-0.5 text-[11px] font-medium text-white", colorByTrip[t.id])}
                            title={t.name}
                          >
                            {t.name}
                          </Link>
                        ))}
                        {dayTrips.length > 3 && (
                          <p className="px-1 text-[11px] font-medium text-text-muted">
                            +{dayTrips.length - 3} more
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Trip list */}
        <aside>
          <h3 className="mb-3 text-h4 text-text-primary">Your Trips</h3>
          <div className="space-y-2">
            {visibleTrips.map((t) => (
              <Link key={t.id} href={`/trips/${t.id}`} className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3 transition-colors hover:bg-surface-muted">
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
