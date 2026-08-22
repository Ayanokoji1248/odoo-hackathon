import type { City, Trip } from "@/types";
import { apiFetch } from "./client";
import { type ApiTrip, toTrip } from "./trips";

/** Wire shape of `GET /api/v1/dashboard` — the whole home screen in one call. */
interface ApiDashboard {
  counts: { total: number; upcoming: number; ongoing: number; past: number };
  upcoming_trips: ApiTrip[];
  popular_cities: Array<{
    id: string;
    name: string;
    country: string;
    region: string | null;
    cost_index: number;
    popularity_score: number;
    image_url: string | null;
    tags: string[];
    best_season: string | null;
    avg_daily_cost: string | null;
  }>;
  budget_highlight: {
    trip: ApiTrip;
    grand_total: string;
    avg_per_day: string;
    currency: string;
  } | null;
}

export interface DashboardData {
  counts: { total: number; upcoming: number; ongoing: number; past: number };
  upcomingTrips: Trip[];
  popularCities: City[];
  budgetHighlight: {
    trip: Trip;
    grandTotal: number;
    avgPerDay: number;
    currency: string;
  } | null;
}

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1520986606214-8b456906c813?auto=format&fit=crop&w=800&q=80";

function toCostIndex(costIndex: number): City["costIndex"] {
  if (costIndex <= 35) return "$";
  if (costIndex <= 60) return "$$";
  if (costIndex <= 80) return "$$$";
  return "$$$$";
}

function toCity(city: ApiDashboard["popular_cities"][number]): City {
  return {
    id: city.id,
    name: city.name,
    country: city.country,
    region: (city.region ?? "Europe") as City["region"],
    imageUrl: city.image_url ?? FALLBACK_IMAGE,
    description: "",
    costIndex: toCostIndex(city.cost_index),
    popularity: city.popularity_score,
    avgDailyCost: Number(city.avg_daily_cost ?? 0),
    tags: city.tags,
    bestSeason: city.best_season ?? "Year round",
  };
}

export async function getDashboard(): Promise<DashboardData> {
  const d = await apiFetch<ApiDashboard>("/api/v1/dashboard");
  return {
    counts: d.counts,
    upcomingTrips: d.upcoming_trips.map(toTrip),
    popularCities: d.popular_cities.map(toCity),
    budgetHighlight: d.budget_highlight
      ? {
          trip: toTrip(d.budget_highlight.trip),
          grandTotal: Number(d.budget_highlight.grand_total),
          avgPerDay: Number(d.budget_highlight.avg_per_day),
          currency: d.budget_highlight.currency,
        }
      : null,
  };
}
