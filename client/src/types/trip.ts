import type { CostIndex } from "./city";

export type TripStatus = "upcoming" | "ongoing" | "completed" | "draft";

export interface TripStop {
  id: string;
  cityId: string;
  cityName: string;
  country: string;
  imageUrl: string;
  startDate: string; // ISO
  endDate: string; // ISO
  /** Carried through from the nested city on the API response. */
  costIndex?: CostIndex;
  tags?: string[];
}

export interface Trip {
  id: string;
  name: string;
  description?: string;
  coverImage: string;
  startDate: string; // ISO
  endDate: string; // ISO
  status: TripStatus;
  stops: TripStop[];
  /** Activities (x travelers) plus manual budget items. */
  estimatedBudget: number;
  activityCount: number;
  isPublic: boolean;
  shareToken?: string;
  createdAt: string;

  /** Ordered city names. Always present from the API; list responses carry these
   *  instead of the full `stops` array, which is detail-only. */
  cityNames?: string[];
  stopCount?: number;
  travelers?: number;
  currency?: string;
  durationDays?: number;
  /** Not exposed by the API - a trip is only ever fetched by its owner. */
  ownerId?: string;
}
