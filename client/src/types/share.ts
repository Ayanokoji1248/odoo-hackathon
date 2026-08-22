import type { Trip } from "./trip";
import type { Itinerary } from "./itinerary";
import type { Budget } from "./budget";

export interface SharedTrip {
  /** The `share_slug` the link was opened with. */
  shareToken: string;
  trip: Trip;
  itinerary: Itinerary;
  budget: Budget;
  /** The owner's display name - the only thing about them the API exposes. */
  ownerName: string;
  /** Real: counted from `copied_from_trip_id` on every copy. */
  copies: number;
}

/* `views` and `ownerAvatar` used to live here. Neither exists: there is no view
   counter column (and no request to add one), and the public payload carries no
   avatar by design. Inventing both is what the mock did. */
