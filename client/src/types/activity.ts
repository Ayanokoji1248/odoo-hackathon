/** Mirrors the Postgres `activity_category` enum, title-cased for display.
 *  "Nature" is legacy: mock rows still use it, the API never returns it. */
export type ActivityCategory =
  | "Sightseeing"
  | "Food"
  | "Adventure"
  | "Culture"
  | "Shopping"
  | "Nightlife"
  | "Relaxation"
  | "Transport"
  | "Nature";

export interface Activity {
  id: string;
  name: string;
  cityId: string;
  cityName: string;
  category: ActivityCategory;
  imageUrl: string;
  description: string;
  durationHours: number;
  /** In the catalog currency (USD). */
  cost: number;
  /** No review system exists - these are mock-only, never served by the API. */
  rating?: number;
  reviews?: number;
  tags?: string[];
}
