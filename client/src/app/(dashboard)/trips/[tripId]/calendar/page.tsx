"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TripHeader } from "@/components/trips/TripHeader";
import { CalendarView } from "@/components/calendar/CalendarView";
import { Card } from "@/components/ui/Card";
import { getTrip } from "@/lib/api/trips";
import { getItinerary } from "@/lib/api/itinerary";
import type { Itinerary, Trip } from "@/types";

export default function CalendarPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const [state, setState] = useState<{ trip: Trip; itinerary: Itinerary } | null | undefined>(
    undefined
  );

  const load = useCallback(() => {
    Promise.all([getTrip(tripId), getItinerary(tripId)])
      .then(([trip, itinerary]) => setState(trip ? { trip, itinerary } : null))
      .catch(() => setState(null));
  }, [tripId]);

  useEffect(() => {
    load();
  }, [load]);

  if (state === undefined) return <div className="h-64 animate-pulse rounded-3xl bg-black/5" />;
  if (state === null) {
    return (
      <Card>
        <p className="text-text-secondary">That trip could not be found.</p>
      </Card>
    );
  }

  return (
    <div>
      <TripHeader trip={state.trip} onChanged={load} />
      <div className="mt-6">
        <CalendarView itinerary={state.itinerary} />
      </div>
    </div>
  );
}
