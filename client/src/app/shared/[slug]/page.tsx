import { notFound } from "next/navigation";
import { PublicTripStory } from "@/components/share/PublicTripStory";
import { getTripByShareToken } from "@/data/mock/trips";
import { getItineraryByTrip } from "@/data/mock/itinerary";
import { getBudgetByTrip } from "@/data/mock/budget";
import { mockUser } from "@/data/mock/users";
import type { SharedTrip } from "@/types";

export default async function SharedTripPage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;
  const trip = getTripByShareToken(shareToken);
  if (!trip) notFound();

  const shared: SharedTrip = {
    shareToken,
    trip,
    itinerary: getItineraryByTrip(trip.id),
    budget: getBudgetByTrip(trip.id),
    ownerName: mockUser.name,
    ownerAvatar: mockUser.avatarUrl,
    views: 1284,
    copies: 47,
  };

  return <PublicTripStory shared={shared} />;
}
