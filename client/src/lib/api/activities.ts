import type { Activity, ActivityCategory } from "@/types";
import { ApiError, apiFetch, fetchAllPages } from "./client";

/** Wire shape of `GET /api/v1/activities`. */
interface ApiActivity {
  id: string;
  city_id: string;
  city_name: string;
  name: string;
  category: string; // the Postgres enum: uppercase
  estimated_cost: string; // Decimal — arrives as a string
  currency: string;
  duration_minutes: number | null;
  image_url: string | null;
  description?: string | null;
}

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1492666673288-3c4b4576ad9a?auto=format&fit=crop&w=800&q=80";

/** Postgres enum values are uppercase; the UI labels are title case. */
const CATEGORY_LABELS: Record<string, ActivityCategory> = {
  SIGHTSEEING: "Sightseeing",
  FOOD: "Food",
  ADVENTURE: "Adventure",
  CULTURE: "Culture",
  NIGHTLIFE: "Nightlife",
  SHOPPING: "Shopping",
  RELAXATION: "Relaxation",
  TRANSPORT: "Transport",
};

function toActivity(activity: ApiActivity): Activity {
  return {
    id: activity.id,
    name: activity.name,
    cityId: activity.city_id,
    cityName: activity.city_name,
    category: CATEGORY_LABELS[activity.category] ?? "Sightseeing",
    imageUrl: activity.image_url ?? FALLBACK_IMAGE,
    description: activity.description ?? "",
    // The API stores minutes; the cards show hours to one decimal.
    durationHours: activity.duration_minutes
      ? Math.round((activity.duration_minutes / 60) * 10) / 10
      : 0,
    cost: Number(activity.estimated_cost),
  };
}

export async function getActivities(): Promise<Activity[]> {
  const rows = await fetchAllPages<ApiActivity>("/api/v1/activities");
  return rows.map(toActivity);
}

export async function getActivitiesForCity(cityId: string): Promise<Activity[]> {
  const rows = await fetchAllPages<ApiActivity>("/api/v1/activities", { city_id: cityId });
  return rows.map(toActivity);
}

export async function getActivity(id: string): Promise<Activity | undefined> {
  try {
    return toActivity(await apiFetch<ApiActivity>(`/api/v1/activities/${id}`));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return undefined;
    throw error;
  }
}
