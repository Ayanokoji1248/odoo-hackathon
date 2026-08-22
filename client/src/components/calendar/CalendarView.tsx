"use client";

import { useState } from "react";
import { CalendarDays, ListOrdered, MapPin } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { getCategoryMeta } from "@/lib/constants/categories";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { Itinerary } from "@/types";

type Mode = "calendar" | "timeline";

export function CalendarView({ itinerary }: { itinerary: Itinerary }) {
  const [mode, setMode] = useState<Mode>("timeline");
  const days = itinerary.days;

  if (days.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Nothing scheduled yet"
        description="Build your itinerary to see it laid out on the calendar and timeline."
      />
    );
  }

  return (
    <div>
      {/* Toggle */}
      <div className="mb-6 inline-flex rounded-xl border border-border bg-surface p-1">
        {(["calendar", "timeline"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition-colors",
              mode === m ? "bg-primary text-white" : "text-text-secondary hover:text-text-primary"
            )}
          >
            {m === "calendar" ? <CalendarDays className="h-4 w-4" /> : <ListOrdered className="h-4 w-4" />}
            {m}
          </button>
        ))}
      </div>

      {mode === "calendar" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {days.map((day, i) => (
            <div key={day.id} className="rounded-2xl border border-border bg-surface p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-caption font-semibold uppercase text-primary">Day {i + 1}</p>
                  <p className="font-semibold text-text-primary">
                    {formatDate(day.date, { weekday: "short", month: "short", day: "numeric" })}
                  </p>
                </div>
                <span className="text-caption text-text-muted">{day.cityName}</span>
              </div>
              <ul className="space-y-2">
                {day.items.map((item) => {
                  const meta = getCategoryMeta(item.category);
                  return (
                    <li key={item.id} className="flex items-center gap-2 rounded-lg bg-surface-muted p-2">
                      <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md", meta.color)}>
                        <meta.icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="w-10 shrink-0 text-caption font-medium text-text-secondary">{item.time}</span>
                      <span className="truncate text-sm text-text-primary">{item.title}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {days.map((day, i) => (
            <div key={day.id}>
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-h4 text-text-primary">
                    {formatDate(day.date, { weekday: "long", month: "long", day: "numeric" })}
                  </h3>
                  <p className="flex items-center gap-1 text-sm text-text-secondary">
                    <MapPin className="h-3.5 w-3.5" /> {day.cityName}
                  </p>
                </div>
              </div>

              <ol className="relative ml-5 space-y-5 border-l-2 border-border pl-6">
                {day.items.map((item) => {
                  const meta = getCategoryMeta(item.category);
                  return (
                    <li key={item.id} className="relative">
                      <span className={cn("absolute -left-[33px] flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-background", meta.color)}>
                        <meta.icon className="h-3 w-3" />
                      </span>
                      <div className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface p-3">
                        <div>
                          <p className="text-caption font-semibold text-text-secondary">{item.time}</p>
                          <p className="font-medium text-text-primary">{item.title}</p>
                          {item.location && (
                            <p className="mt-0.5 text-caption text-text-muted">{item.location}</p>
                          )}
                        </div>
                        <span className="whitespace-nowrap text-sm font-medium text-text-primary">
                          {item.cost === 0 ? "Free" : formatCurrency(item.cost)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
