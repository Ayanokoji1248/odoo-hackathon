import { getTripByShareToken } from "@/data/mock/trips";
import { getItineraryByTrip } from "@/data/mock/itinerary";
import { getBudgetByTrip } from "@/data/mock/budget";
import { mockUser } from "@/data/mock/users";
import type { SharedTrip } from "@/types";
import { delay } from "./client";

export async function getSharedTrip(token: string): Promise<SharedTrip | undefined> {
  const trip = getTripByShareToken(token);
  if (!trip) return delay(undefined);
  return delay({
    shareToken: token,
    trip,
    itinerary: getItineraryByTrip(trip.id),
    budget: getBudgetByTrip(trip.id),
    ownerName: mockUser.name,
    ownerAvatar: mockUser.avatarUrl,
    views: 1284,
    copies: 47,
  });
}
