import type { Trip } from "./trip";
import type { Itinerary } from "./itinerary";
import type { Budget } from "./budget";

export interface SharedTrip {
  shareToken: string;
  trip: Trip;
  itinerary: Itinerary;
  budget: Budget;
  ownerName: string;
  ownerAvatar?: string;
  views: number;
  copies: number;
}
