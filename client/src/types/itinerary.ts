import type { ActivityCategory } from "./activity";

export interface ItineraryItem {
  id: string;
  time: string; // "09:00"
  title: string;
  category: ActivityCategory | "Transport" | "Meal" | "Rest";
  activityId?: string;
  durationHours?: number;
  cost: number; // in INR
  notes?: string;
  location?: string;
}

export interface ItineraryDay {
  id: string;
  date: string; // ISO
  stopId: string;
  cityName: string;
  items: ItineraryItem[];
}

export interface Itinerary {
  tripId: string;
  days: ItineraryDay[];
}
