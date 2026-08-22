import { notFound } from "next/navigation";
import { TripHeader } from "@/components/trips/TripHeader";
import { CalendarView } from "@/components/calendar/CalendarView";
import { getTripById } from "@/data/mock/trips";
import { getItineraryByTrip } from "@/data/mock/itinerary";

export default async function CalendarPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const trip = getTripById(tripId);
  if (!trip) notFound();
  const itinerary = getItineraryByTrip(tripId);

  return (
    <div>
      <TripHeader trip={trip} />
      <div className="mt-6">
        <CalendarView itinerary={itinerary} />
      </div>
    </div>
  );
}
