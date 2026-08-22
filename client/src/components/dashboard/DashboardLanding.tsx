"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { BannerSlider } from "@/components/dashboard/BannerSlider";
import { DestinationBanner } from "@/components/dashboard/DestinationBanner";
import { TripSlider } from "@/components/trips/TripSlider";
import { SectionHeading } from "@/components/layout/SectionHeading";
import type { City, Trip } from "@/types";

export function DashboardLanding({ name, cities, trips }: { name: string; cities: City[]; trips: Trip[] }) {
  const router = useRouter();
  const firstName = name.split(" ")[0];
  const previous = trips.filter((t) => t.status === "completed");

  return (
    <div>
      {/* Hero banner (full width, flush under navbar) */}
      <div className="relative left-1/2 -mt-6 mb-10 w-screen -translate-x-1/2">
        <BannerSlider firstName={firstName} />
      </div>

      {/* Explore top destinations (full width band) */}
      <div className="relative left-1/2 mb-10 w-screen -translate-x-1/2">
        <DestinationBanner cities={cities} />
      </div>

      {/* Previous Trips */}
      <section>
        <SectionHeading title="Previous Trips" href="/trips" />
        {previous.length === 0 ? (
          <Card className="text-center text-text-secondary">No previous trips yet.</Card>
        ) : (
          <TripSlider trips={previous} />
        )}
      </section>

      {/* Floating plan button on mobile */}
      <button
        onClick={() => router.push("/trips/create")}
        className="fixed bottom-20 right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-pop transition-transform active:scale-95 lg:hidden"
        aria-label="Plan a trip"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}
