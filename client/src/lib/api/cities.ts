import type { City, CostIndex, Region } from "@/types";
import { ApiError, apiFetch, fetchAllPages } from "./client";

/** Wire shape of `GET /api/v1/cities`. */
interface ApiCity {
  id: string;
  name: string;
  country: string;
  region: string | null;
  cost_index: number;
  popularity_score: number;
  image_url: string | null;
  tags: string[];
  best_season: string | null;
  avg_daily_cost: string | null; // Decimal — arrives as a string, never a float
  // detail only
  latitude?: string | null;
  longitude?: string | null;
  description?: string | null;
}

/** Used only if a row somehow has no image; the seed fills every one. */
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1520986606214-8b456906c813?auto=format&fit=crop&w=800&q=80";

/** The API stores cost as an index of 1-100; the UI shows $ … $$$$. */
function toCostIndex(costIndex: number): CostIndex {
  if (costIndex <= 35) return "$";
  if (costIndex <= 60) return "$$";
  if (costIndex <= 80) return "$$$";
  return "$$$$";
}

function toCity(city: ApiCity): City {
  return {
    id: city.id,
    name: city.name,
    country: city.country,
    // The seed only ever writes the seven values in the Region union.
    region: (city.region ?? "Europe") as Region,
    imageUrl: city.image_url ?? FALLBACK_IMAGE,
    description: city.description ?? "",
    costIndex: toCostIndex(city.cost_index),
    popularity: city.popularity_score,
    avgDailyCost: Number(city.avg_daily_cost ?? 0),
    tags: city.tags,
    bestSeason: city.best_season ?? "Year round",
  };
}

export async function getCities(): Promise<City[]> {
  const rows = await fetchAllPages<ApiCity>("/api/v1/cities");
  return rows.map(toCity);
}

export async function getCity(id: string): Promise<City | undefined> {
  try {
    return toCity(await apiFetch<ApiCity>(`/api/v1/cities/${id}`));
  } catch (error) {
    // Callers treat "no such city" as absence, not failure.
    if (error instanceof ApiError && error.status === 404) return undefined;
    throw error;
  }
}

export async function getPopularCities(limit = 8): Promise<City[]> {
  const rows = await apiFetch<ApiCity[]>(`/api/v1/cities/popular?limit=${limit}`);
  return rows.map(toCity);
}

// --- saved destinations (requires a signed-in session) ------------------------

export async function getSavedCities(): Promise<City[]> {
  const rows = await apiFetch<ApiCity[]>("/api/v1/users/me/saved-destinations");
  return rows.map(toCity);
}

export async function saveCity(cityId: string): Promise<City> {
  const city = await apiFetch<ApiCity>("/api/v1/users/me/saved-destinations", {
    method: "POST",
    body: JSON.stringify({ city_id: cityId }),
  });
  return toCity(city);
}

export async function unsaveCity(cityId: string): Promise<void> {
  await apiFetch<{ removed: boolean }>(`/api/v1/users/me/saved-destinations/${cityId}`, {
    method: "DELETE",
  });
}
