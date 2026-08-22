"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { TripCalendar } from "@/components/calendar/TripCalendar";
import { getTrips } from "@/lib/api/trips";
import type { Trip } from "@/types";

export default function CalendarPage() {
  const [trips, setTrips] = useState<Trip[]>([]);

  useEffect(() => {
    getTrips()
      .then(setTrips)
      .catch(() => setTrips([]));
  }, []);

  return (
    <div>
      <PageHeader title="Calendar View" subtitle="All your trips laid out across the year." />
      <TripCalendar trips={trips} />
    </div>
  );
}
