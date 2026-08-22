"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TripHeader } from "@/components/trips/TripHeader";
import { BudgetView } from "@/components/budget/BudgetView";
import { Card } from "@/components/ui/Card";
import { getTrip } from "@/lib/api/trips";
import { getBudget } from "@/lib/api/budget";
import type { Budget, Trip } from "@/types";

export default function BudgetPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const [state, setState] = useState<{ trip: Trip; budget: Budget } | null | undefined>(
    undefined
  );

  useEffect(() => {
    Promise.all([getTrip(tripId), getBudget(tripId)])
      .then(([trip, budget]) => setState(trip ? { trip, budget } : null))
      .catch(() => setState(null));
  }, [tripId]);

  if (state === undefined) return <div className="h-64 animate-pulse rounded-3xl bg-black/5" />;
  if (state === null) {
    return (
      <Card>
        <p className="text-text-secondary">That trip&apos;s budget could not be loaded.</p>
      </Card>
    );
  }

  return (
    <div>
      <TripHeader trip={state.trip} />
      <div className="mt-6">
        <BudgetView trip={state.trip} budget={state.budget} />
      </div>
    </div>
  );
}
