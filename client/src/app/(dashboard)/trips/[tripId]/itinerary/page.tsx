"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TripHeader } from "@/components/trips/TripHeader";
import { ItineraryBuilder } from "@/components/itinerary/ItineraryBuilder";
import { Card } from "@/components/ui/Card";
import { getTripTree, toTrip, type ApiTrip } from "@/lib/api/trips";

export default function ItineraryPage() {
  const { tripId } = useParams<{ tripId: string }>();
  // The raw tree, not the mapped Trip: the builder needs each stop's id,
  // order_index and activities, and toTrip() drops all three.
  const [tree, setTree] = useState<ApiTrip | null | undefined>(undefined);

  // Returns the promise so callers can await the refetch before re-enabling
  // their buttons. `.then` rather than `async`/`await`: setState must not run
  // synchronously inside the effect below.
  const load = useCallback(
    () =>
      getTripTree(tripId)
        .then((t) => setTree(t ?? null))
        .catch(() => setTree(null)),
    [tripId]
  );

  useEffect(() => {
    load();
  }, [load]);

  if (tree === undefined) return <div className="h-64 animate-pulse rounded-3xl bg-black/5" />;
  if (tree === null) {
    return (
      <Card>
        <p className="text-text-secondary">That trip could not be found.</p>
      </Card>
    );
  }

  const trip = toTrip(tree);

  return (
    <div>
      <TripHeader trip={trip} onChanged={load} />
      <div className="mt-6">
        <ItineraryBuilder trip={trip} stops={tree.stops ?? []} onChanged={load} />
      </div>
    </div>
  );
}
