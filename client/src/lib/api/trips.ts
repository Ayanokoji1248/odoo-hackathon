import type { CostIndex, Trip, TripStatus, TripStop } from "@/types";
import { ApiError, apiFetch, fetchAllPages } from "./client";

/** Wire shape of a trip from `GET /api/v1/trips` (and the tree endpoint). */
export interface ApiTripStop {
  id: string;
  trip_id: string;
  city_id: string;
  city: {
    id: string;
    name: string;
    country: string;
    image_url: string | null;
    cost_index: number;
    tags: string[];
  };
  start_date: string;
  end_date: string;
  order_index: number;
  notes: string | null;
  activities: ApiTripActivity[];
}

export interface ApiTripActivity {
  id: string;
  trip_stop_id: string;
  activity_id: string | null;
  name: string;
  category: string | null;
  scheduled_date: string;
  start_time: string | null;
  duration_minutes: number | null;
  cost: string;
  order_index: number;
  notes: string | null;
}

export interface ApiTrip {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  cover_photo_url: string | null;
  travelers: number;
  currency: string;
  is_public: boolean;
  share_slug: string | null;
  copied_from_trip_id: string | null;
  status: "upcoming" | "ongoing" | "past";
  duration_days: number;
  created_at: string;
  activity_count: number;
  estimated_total: string;
  stop_count: number;
  city_names: string[];
  stops?: ApiTripStop[]; // detail only
}

const FALLBACK_COVER =
  "https://images.unsplash.com/photo-1520986606214-8b456906c813?auto=format&fit=crop&w=1200&q=80";

/** cost_index is 1-100 on the API; the UI shows $ … $$$$. Mirrors cities.ts. */
function toCostIndex(costIndex: number): CostIndex {
  if (costIndex <= 35) return "$";
  if (costIndex <= 60) return "$$";
  if (costIndex <= 80) return "$$$";
  return "$$$$";
}

/** The API calls a finished trip "past"; the UI has always called it "completed". */
function toStatus(status: ApiTrip["status"]): TripStatus {
  return status === "past" ? "completed" : status;
}

function toStop(stop: ApiTripStop): TripStop {
  return {
    id: stop.id,
    cityId: stop.city_id,
    cityName: stop.city.name,
    country: stop.city.country,
    imageUrl: stop.city.image_url ?? FALLBACK_COVER,
    startDate: stop.start_date,
    endDate: stop.end_date,
    costIndex: toCostIndex(stop.city.cost_index),
    tags: stop.city.tags,
  };
}

export function toTrip(trip: ApiTrip): Trip {
  const stops = (trip.stops ?? []).map(toStop);
  return {
    id: trip.id,
    name: trip.name,
    description: trip.description ?? undefined,
    // A trip has no cover until someone sets one; the card needs a src regardless.
    coverImage: trip.cover_photo_url ?? FALLBACK_COVER,
    startDate: trip.start_date,
    endDate: trip.end_date,
    status: toStatus(trip.status),
    stops,
    // List responses carry names only - the full stop list is detail-only.
    cityNames: trip.city_names,
    stopCount: trip.stop_count || stops.length,
    estimatedBudget: Number(trip.estimated_total),
    activityCount: trip.activity_count,
    isPublic: trip.is_public,
    shareToken: trip.share_slug ?? undefined,
    createdAt: trip.created_at,
    travelers: trip.travelers,
    currency: trip.currency,
    durationDays: trip.duration_days,
  };
}

export async function getTrips(): Promise<Trip[]> {
  const rows = await fetchAllPages<ApiTrip>("/api/v1/trips");
  return rows.map(toTrip);
}

/** Full nested itinerary: stops, their cities and their activities. */
export async function getTrip(id: string): Promise<Trip | undefined> {
  try {
    return toTrip(await apiFetch<ApiTrip>(`/api/v1/trips/${id}`));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return undefined;
    throw error;
  }
}

/** The raw tree, for callers that need activities as well as stops. */
export async function getTripTree(id: string): Promise<ApiTrip | undefined> {
  try {
    return await apiFetch<ApiTrip>(`/api/v1/trips/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return undefined;
    throw error;
  }
}

export interface CreateTripInput {
  name: string;
  startDate: string;
  endDate: string;
  description?: string;
  travelers?: number;
  currency?: string;
  coverPhotoUrl?: string;
}

export async function createTrip(input: CreateTripInput): Promise<Trip> {
  const trip = await apiFetch<ApiTrip>("/api/v1/trips", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      start_date: input.startDate,
      end_date: input.endDate,
      ...(input.description ? { description: input.description } : {}),
      ...(input.travelers ? { travelers: input.travelers } : {}),
      ...(input.currency ? { currency: input.currency } : {}),
      ...(input.coverPhotoUrl ? { cover_photo_url: input.coverPhotoUrl } : {}),
    }),
  });
  return toTrip(trip);
}

export async function deleteTrip(id: string): Promise<void> {
  await apiFetch<{ deleted: boolean }>(`/api/v1/trips/${id}`, { method: "DELETE" });
}

export async function duplicateTrip(id: string, startDate?: string): Promise<Trip> {
  const trip = await apiFetch<ApiTrip>(`/api/v1/trips/${id}/duplicate`, {
    method: "POST",
    body: JSON.stringify(startDate ? { start_date: startDate } : {}),
  });
  return toTrip(trip);
}

// --- stops --------------------------------------------------------------------

export async function addStop(
  tripId: string,
  input: { cityId: string; startDate: string; endDate: string; notes?: string }
): Promise<{ stop: TripStop; warnings: string[] }> {
  const result = await apiFetch<{ stop: ApiTripStop; warnings: string[] }>(
    `/api/v1/trips/${tripId}/stops`,
    {
      method: "POST",
      body: JSON.stringify({
        city_id: input.cityId,
        start_date: input.startDate,
        end_date: input.endDate,
        ...(input.notes ? { notes: input.notes } : {}),
      }),
    }
  );
  return { stop: toStop(result.stop), warnings: result.warnings };
}

export async function deleteStop(tripId: string, stopId: string): Promise<void> {
  await apiFetch<{ deleted: boolean }>(`/api/v1/trips/${tripId}/stops/${stopId}`, {
    method: "DELETE",
  });
}

/** Send the complete ordered id list - a partial one is rejected by the API. */
export async function reorderStops(tripId: string, order: string[]): Promise<TripStop[]> {
  const stops = await apiFetch<ApiTripStop[]>(`/api/v1/trips/${tripId}/stops/reorder`, {
    method: "PATCH",
    body: JSON.stringify({ order }),
  });
  return stops.map(toStop);
}

// --- activities on a stop -----------------------------------------------------

export async function addTripActivity(
  tripId: string,
  stopId: string,
  input: {
    activityId?: string;
    name?: string;
    scheduledDate: string;
    startTime?: string;
    cost?: number;
    notes?: string;
  }
): Promise<ApiTripActivity> {
  return apiFetch<ApiTripActivity>(
    `/api/v1/trips/${tripId}/stops/${stopId}/activities`,
    {
      method: "POST",
      body: JSON.stringify({
        ...(input.activityId ? { activity_id: input.activityId } : {}),
        ...(input.name ? { name: input.name } : {}),
        scheduled_date: input.scheduledDate,
        ...(input.startTime ? { start_time: input.startTime } : {}),
        ...(input.cost !== undefined ? { cost: input.cost.toFixed(2) } : {}),
        ...(input.notes ? { notes: input.notes } : {}),
      }),
    }
  );
}

export async function deleteTripActivity(
  tripId: string,
  stopId: string,
  itemId: string
): Promise<void> {
  await apiFetch<{ deleted: boolean }>(
    `/api/v1/trips/${tripId}/stops/${stopId}/activities/${itemId}`,
    { method: "DELETE" }
  );
}
