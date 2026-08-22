"use client";

import { useCallback, useEffect, useState } from "react";
import { Bookmark } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { CityCard } from "@/components/cities/CityCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { getSavedCities } from "@/lib/api/cities";
import { ApiError } from "@/lib/api/client";
import type { City } from "@/types";

/**
 * Client component rather than a server one: the saved list is per-user, and the
 * session cookie is only attached to requests the browser makes.
 */
export default function SavedPage() {
  const [saved, setSaved] = useState<City[] | null>(null);
  const [signedOut, setSignedOut] = useState(false);

  const load = useCallback(
    () =>
      getSavedCities()
        .then(setSaved)
        .catch((error) => {
          if (error instanceof ApiError && error.status === 401) setSignedOut(true);
          setSaved([]);
        }),
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader title="Saved" subtitle="Destinations you've bookmarked for later." />

      {saved === null ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-80 animate-pulse rounded-xl bg-black/5" />
          ))}
        </div>
      ) : signedOut ? (
        <EmptyState
          icon={Bookmark}
          title="Sign in to see your saved places"
          description="Your bookmarks are tied to your account."
        />
      ) : saved.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="Nothing saved yet"
          description="Hit Save on any city in Explore and it lands here."
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {saved.map((city) => (
            // Every card here is saved by definition; un-saving drops it.
            <CityCard key={city.id} city={city} saved onToggled={load} />
          ))}
        </div>
      )}
    </div>
  );
}
