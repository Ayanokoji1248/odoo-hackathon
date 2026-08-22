"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { TripsExplorer } from "@/components/trips/TripsExplorer";
import { getTrips } from "@/lib/api/trips";
import type { Trip } from "@/types";

/**
 * Client component, not a server one: trips are user-scoped and the session
 * cookie only travels with requests the browser makes. Server-rendering it would
 * 401 — and RequireAuth already gates this whole subtree behind a spinner, so
 * SSR would buy nothing even if the cookie were forwarded.
 */
export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[] | null>(null);

  useEffect(() => {
    getTrips()
      .then(setTrips)
      .catch(() => setTrips([]));
  }, []);

  return (
    <div>
      <PageHeader
        title="My Trips"
        subtitle="All your adventures, past and planned."
        actions={
          <Link href="/trips/create">
            <Button>
              <Plus className="h-4 w-4" /> New Trip
            </Button>
          </Link>
        }
      />
      {trips === null ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-80 animate-pulse rounded-2xl bg-black/5" />
          ))}
        </div>
      ) : (
        <TripsExplorer trips={trips} />
      )}
    </div>
  );
}
