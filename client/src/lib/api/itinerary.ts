import { getItineraryByTrip } from "@/data/mock/itinerary";
import type { Itinerary } from "@/types";
import { delay } from "./client";

export async function getItinerary(tripId: string): Promise<Itinerary> {
  return delay(getItineraryByTrip(tripId));
}
