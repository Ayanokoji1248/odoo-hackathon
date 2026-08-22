import type { Itinerary, ItineraryDay, ItineraryItem } from "@/types";
import type { ActivityCategory } from "@/types/activity";
import { type ApiTrip, type ApiTripActivity, getTripTree } from "./trips";

/**
 * The itinerary is a view of the trip tree, not a separate resource — so this
 * reads `GET /trips/{id}` and pivots stops-with-activities into days.
 */

const CATEGORY_LABELS: Record<string, ItineraryItem["category"]> = {
  SIGHTSEEING: "Sightseeing",
  FOOD: "Food",
  ADVENTURE: "Adventure",
  CULTURE: "Culture",
  NIGHTLIFE: "Nightlife",
  SHOPPING: "Shopping",
  RELAXATION: "Rest",
  TRANSPORT: "Transport",
};

function eachDay(start: string, end: string): string[] {
  const days: string[] = [];
  for (const cursor = new Date(start); cursor <= new Date(end); cursor.setDate(cursor.getDate() + 1)) {
    days.push(cursor.toISOString().slice(0, 10));
  }
  return days;
}

function toItem(activity: ApiTripActivity): ItineraryItem {
  return {
    id: activity.id,
    // The API allows an activity with no time; the UI shows a placeholder.
    time: activity.start_time ? activity.start_time.slice(0, 5) : "--:--",
    title: activity.name,
    category: (activity.category
      ? (CATEGORY_LABELS[activity.category] ?? "Sightseeing")
      : "Sightseeing") as ActivityCategory,
    activityId: activity.activity_id ?? undefined,
    durationHours: activity.duration_minutes
      ? Math.round((activity.duration_minutes / 60) * 10) / 10
      : undefined,
    cost: Number(activity.cost),
    notes: activity.notes ?? undefined,
  };
}

export function toItinerary(trip: ApiTrip): Itinerary {
  const days: ItineraryDay[] = [];

  for (const stop of trip.stops ?? []) {
    for (const date of eachDay(stop.start_date, stop.end_date)) {
      days.push({
        id: `${stop.id}-${date}`,
        date,
        stopId: stop.id,
        cityName: stop.city.name,
        items: stop.activities
          .filter((activity) => activity.scheduled_date === date)
          .sort((a, b) => a.order_index - b.order_index)
          .map(toItem),
      });
    }
  }

  return { tripId: trip.id, days };
}

export async function getItinerary(tripId: string): Promise<Itinerary> {
  const trip = await getTripTree(tripId);
  return trip ? toItinerary(trip) : { tripId, days: [] };
}
