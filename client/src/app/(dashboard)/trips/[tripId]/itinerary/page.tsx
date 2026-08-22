import { notFound } from "next/navigation";
import { TripHeader } from "@/components/trips/TripHeader";
import { SectionItineraryBuilder } from "@/components/itinerary/SectionItineraryBuilder";
import { getTripById } from "@/data/mock/trips";

export default async function ItineraryPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const trip = getTripById(tripId);
  if (!trip) notFound();

  return (
    <div>
      <TripHeader trip={trip} />
      <div className="mt-6">
        <SectionItineraryBuilder trip={trip} />
      </div>
    </div>
  );
}
