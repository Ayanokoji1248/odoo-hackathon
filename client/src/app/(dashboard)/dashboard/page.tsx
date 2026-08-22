"use client";

import { useEffect, useState } from "react";
import { DashboardLanding } from "@/components/dashboard/DashboardLanding";
import { useUser } from "@/lib/auth/AuthProvider";
import { getDashboard, type DashboardData } from "@/lib/api/dashboard";

export default function DashboardPage() {
  const user = useUser();
  const [data, setData] = useState<DashboardData | null>(null);

  // One request fills the whole screen - see GET /api/v1/dashboard.
  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch(() =>
        setData({
          counts: { total: 0, upcoming: 0, ongoing: 0, past: 0 },
          upcomingTrips: [],
          popularCities: [],
          budgetHighlight: null,
        })
      );
  }, []);

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="h-48 animate-pulse rounded-2xl bg-black/5" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-black/5" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <DashboardLanding
      name={user.name}
      cities={data.popularCities}
      previousTrips={data.upcomingTrips}
    />
  );
}
