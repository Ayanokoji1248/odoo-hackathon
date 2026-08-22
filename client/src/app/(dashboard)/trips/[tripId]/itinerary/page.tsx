"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TripHeader } from "@/components/trips/TripHeader";
import { SectionItineraryBuilder } from "@/components/itinerary/SectionItineraryBuilder";
import { Card } from "@/components/ui/Card";
import { getTrip } from "@/lib/api/trips";
import type { Trip } from "@/types";

export default function ItineraryPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const [trip, setTrip] = useState<Trip | null | undefined>(undefined);

  useEffect(() => {
    getTrip(tripId)
      .then((t) => setTrip(t ?? null))
      .catch(() => setTrip(null));
  }, [tripId]);

  if (trip === undefined) return <div className="h-64 animate-pulse rounded-3xl bg-black/5" />;
  if (trip === null) {
    return (
      <Card>
        <p className="text-text-secondary">That trip could not be found.</p>
      </Card>
    );
  }

  return (
    <div>
      <TripHeader trip={trip} />
      <div className="mt-6">
        <SectionItineraryBuilder trip={trip} />
      </div>
    </div>
  );
}
