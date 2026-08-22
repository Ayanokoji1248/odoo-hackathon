"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CalendarDays, Building2, Compass, Wallet } from "lucide-react";
import { TripHeader } from "@/components/trips/TripHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getTrip } from "@/lib/api/trips";
import { formatCurrency, formatDateRange, daysBetween, pluralize } from "@/lib/utils/format";
import type { Trip } from "@/types";

export default function TripOverviewPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const [trip, setTrip] = useState<Trip | null | undefined>(undefined);

  const load = useCallback(() => {
    getTrip(tripId)
      .then((t) => setTrip(t ?? null))
      .catch(() => setTrip(null));
  }, [tripId]);

  useEffect(() => {
    load();
  }, [load]);

  if (trip === undefined) return <div className="h-64 animate-pulse rounded-3xl bg-black/5" />;
  if (trip === null) {
    return (
      <Card>
        <p className="text-text-secondary">That trip could not be found.</p>
      </Card>
    );
  }

  const days = trip.durationDays ?? daysBetween(trip.startDate, trip.endDate);
  const currency = trip.currency ?? "USD";

  return (
    <div>
      <TripHeader trip={trip} onChanged={load} />

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Duration" value={pluralize(days, "Day")} icon={CalendarDays} tone="primary" />
        <StatCard label="Cities" value={String(trip.stops.length)} icon={Building2} tone="info" />
        <StatCard label="Activities" value={String(trip.activityCount)} icon={Compass} tone="secondary" />
        <StatCard
          label="Est. Budget"
          value={formatCurrency(trip.estimatedBudget, currency)}
          icon={Wallet}
          tone="success"
        />
      </div>

      {trip.description && (
        <Card className="mt-6">
          <h2 className="text-h4 text-text-primary">About this trip</h2>
          <p className="mt-2 text-text-secondary">{trip.description}</p>
        </Card>
      )}

      <div className="mt-6">
        <h2 className="mb-4 text-h2 text-text-primary">Trip Stops</h2>
        {trip.stops.length === 0 ? (
          <Card>
            <p className="text-text-secondary">
              No stops yet — add a city from the itinerary tab to get started.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {trip.stops.map((stop, i) => (
              <Card key={stop.id} padded={false} className="flex overflow-hidden">
                <div className="relative hidden w-40 shrink-0 sm:block">
                  <Image src={stop.imageUrl} alt={stop.cityName} fill className="object-cover" sizes="160px" />
                </div>
                <div className="flex-1 p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-light text-xs font-bold text-primary-hover">
                          {i + 1}
                        </span>
                        <h3 className="text-h4 text-text-primary">{stop.cityName}</h3>
                      </div>
                      <p className="mt-0.5 text-sm text-text-secondary">{stop.country}</p>
                    </div>
                    {/* Carried through from the nested city on the trip response,
                        so this page needs no extra request per stop. */}
                    {stop.costIndex && <Badge variant="outline">{stop.costIndex}</Badge>}
                  </div>
                  <p className="mt-2 text-sm text-text-secondary">
                    {formatDateRange(stop.startDate, stop.endDate)} ·{" "}
                    {pluralize(daysBetween(stop.startDate, stop.endDate), "day")}
                  </p>
                  {stop.tags && stop.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {stop.tags.slice(0, 4).map((t) => (
                        <Badge key={t}>{t}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
