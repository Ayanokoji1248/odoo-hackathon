"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TripHeader } from "@/components/trips/TripHeader";
import { BudgetView } from "@/components/budget/BudgetView";
import { ManualCosts } from "@/components/budget/ManualCosts";
import { Card } from "@/components/ui/Card";
import { getTrip } from "@/lib/api/trips";
import { getBudget, getBudgetItems, type ApiBudgetItem } from "@/lib/api/budget";
import type { Budget, Trip } from "@/types";

interface State {
  trip: Trip;
  budget: Budget;
  items: ApiBudgetItem[];
}

export default function BudgetPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const [state, setState] = useState<State | null | undefined>(undefined);

  // The summary is computed on read, so adding an item has to re-fetch it - there
  // is no stored total to patch. The item list comes along in the same round.
  const load = useCallback(
    () =>
      Promise.all([getTrip(tripId), getBudget(tripId), getBudgetItems(tripId)])
        .then(([trip, budget, items]) => setState(trip ? { trip, budget, items } : null))
        .catch(() => setState(null)),
    [tripId]
  );

  useEffect(() => {
    load();
  }, [load]);

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
      <TripHeader trip={state.trip} onChanged={load} />
      <div className="mt-6 space-y-6">
        <BudgetView trip={state.trip} budget={state.budget} />
        <ManualCosts
          trip={state.trip}
          items={state.items}
          total={state.budget.manualTotal ?? 0}
          currency={state.budget.currency}
          onChanged={load}
        />
      </div>
    </div>
  );
}
