"use client";

import { DashboardLanding } from "@/components/dashboard/DashboardLanding";
import { useUser } from "@/lib/auth/AuthProvider";
import { mockTrips } from "@/data/mock/trips";
import { mockCities } from "@/data/mock/cities";

export default function DashboardPage() {
  const user = useUser();
  const previousTrips = mockTrips.filter((t) => t.status === "completed");
  return (
    <DashboardLanding
      name={user.name}
      cities={mockCities}
      previousTrips={previousTrips.length ? previousTrips : mockTrips.slice(0, 3)}
    />
  );
}
