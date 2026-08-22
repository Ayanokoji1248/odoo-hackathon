"use client";

import { SectionHeading } from "@/components/layout/SectionHeading";
import { BannerSlider } from "@/components/dashboard/BannerSlider";
import { DestinationBanner } from "@/components/dashboard/DestinationBanner";
import { TripSlider } from "@/components/trips/TripSlider";
import type { City, Trip } from "@/types";

interface Props {
  name: string;
  cities: City[];
  previousTrips: Trip[];
}

export function DashboardLanding({ name, cities, previousTrips }: Props) {
  const firstName = name.split(" ")[0];

  return (
    <div>
      {/* Hero banner (full-width, flush under the navbar) */}
      <div className="relative left-1/2 -mt-6 mb-8 w-screen -translate-x-1/2">
        <BannerSlider firstName={firstName} />
      </div>

      {/* Explore top destinations (full-width band) */}
      <div className="relative left-1/2 mb-10 w-screen -translate-x-1/2">
        <DestinationBanner cities={cities} />
      </div>

      {/* Previous Trips */}
      <section>
        <SectionHeading title="Previous Trips" href="/trips" />
        {previousTrips.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-text-secondary">
            No previous trips yet.
          </div>
        ) : (
          <TripSlider trips={previousTrips} />
        )}
      </section>
    </div>
  );
}
