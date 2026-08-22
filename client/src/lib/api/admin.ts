import { apiFetch, apiFetchPage, type PageMeta } from "./client";

/**
 * Every path here is behind `require_admin` on the server router, so a non-admin
 * gets a 403 rather than an empty payload. The client-side role check in
 * `/admin/layout.tsx` only decides what to render.
 */

// --- analytics ----------------------------------------------------------------

export interface MonthPoint {
  /** First day of the month, ISO. Formatted for display by the caller. */
  month: string;
  count: number;
}

export interface AdminStats {
  usersTotal: number;
  usersActive: number;
  adminsTotal: number;
  tripsTotal: number;
  citiesTotal: number;
  citiesHidden: number;
  activitiesTotal: number;
  activitiesHidden: number;
  avgStopsPerTrip: number;
  avgTripBudget: number;
  currency: string;
  newUsersByMonth: MonthPoint[];
  newTripsByMonth: MonthPoint[];
}

interface ApiStats {
  users_total: number;
  users_active: number;
  admins_total: number;
  trips_total: number;
  cities_total: number;
  cities_hidden: number;
  activities_total: number;
  activities_hidden: number;
  avg_stops_per_trip: string;
  avg_trip_budget: string;
  currency: string;
  new_users_by_month: MonthPoint[];
  new_trips_by_month: MonthPoint[];
}

export async function getStats(): Promise<AdminStats> {
  const s = await apiFetch<ApiStats>("/api/v1/admin/stats");
  return {
    usersTotal: s.users_total,
    usersActive: s.users_active,
    adminsTotal: s.admins_total,
    tripsTotal: s.trips_total,
    citiesTotal: s.cities_total,
    citiesHidden: s.cities_hidden,
    activitiesTotal: s.activities_total,
    activitiesHidden: s.activities_hidden,
    avgStopsPerTrip: Number(s.avg_stops_per_trip),
    avgTripBudget: Number(s.avg_trip_budget),
    currency: s.currency,
    newUsersByMonth: s.new_users_by_month,
    newTripsByMonth: s.new_trips_by_month,
  };
}

export interface TopCity {
  cityId: string;
  name: string;
  country: string;
  tripCount: number;
}

export async function getTopCities(limit = 5): Promise<TopCity[]> {
  const rows = await apiFetch<
    Array<{ city_id: string; name: string; country: string; trip_count: number }>
  >(`/api/v1/admin/cities/top?limit=${limit}`);
  return rows.map((r) => ({
    cityId: r.city_id,
    name: r.name,
    country: r.country,
    tripCount: r.trip_count,
  }));
}

export interface TopActivity {
  activityId: string;
  name: string;
  cityName: string;
  addCount: number;
}

export async function getTopActivities(limit = 5): Promise<TopActivity[]> {
  const rows = await apiFetch<
    Array<{ activity_id: string; name: string; city_name: string; add_count: number }>
  >(`/api/v1/admin/activities/top?limit=${limit}`);
  return rows.map((r) => ({
    activityId: r.activity_id,
    name: r.name,
    cityName: r.city_name,
    addCount: r.add_count,
  }));
}

// --- users --------------------------------------------------------------------

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: "user" | "admin";
  isActive: boolean;
  createdAt: string;
  tripCount: number;
}

interface ApiManagedUser {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: "USER" | "ADMIN";
  is_active: boolean;
  created_at: string;
  trip_count: number;
}

function toManagedUser(user: ApiManagedUser): ManagedUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatar_url ?? undefined,
    role: user.role === "ADMIN" ? "admin" : "user",
    isActive: user.is_active,
    createdAt: user.created_at,
    tripCount: user.trip_count,
  };
}

export interface UserQuery {
  page?: number;
  limit?: number;
  search?: string;
  role?: "user" | "admin";
  isActive?: boolean;
  sort?: "created_at" | "name" | "trips";
}

export async function getUsers(
  query: UserQuery = {}
): Promise<{ users: ManagedUser[]; meta: PageMeta | null }> {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    limit: String(query.limit ?? 20),
    sort: query.sort ?? "created_at",
  });
  // Server-side search and filtering, not a client-side pass over one page -
  // filtering a page of 20 would silently hide matches on page 2.
  if (query.search) params.set("search", query.search);
  if (query.role) params.set("role", query.role.toUpperCase());
  if (query.isActive !== undefined) params.set("is_active", String(query.isActive));

  const { data, meta } = await apiFetchPage<ApiManagedUser[]>(
    `/api/v1/admin/users?${params}`
  );
  return { users: data.map(toManagedUser), meta };
}

/** Role and status only. There is no hard delete - see the schema's note. */
export async function updateUser(
  userId: string,
  input: { role?: "user" | "admin"; isActive?: boolean }
): Promise<ManagedUser> {
  const body: Record<string, unknown> = {};
  if (input.role !== undefined) body.role = input.role.toUpperCase();
  if (input.isActive !== undefined) body.is_active = input.isActive;

  return toManagedUser(
    await apiFetch<ApiManagedUser>(`/api/v1/admin/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    })
  );
}

// --- catalog ------------------------------------------------------------------

export interface AdminCity {
  id: string;
  name: string;
  country: string;
  region?: string;
  costIndex: number;
  popularityScore: number;
  imageUrl?: string;
  description?: string;
  tags: string[];
  bestSeason?: string;
  avgDailyCost?: number;
  isActive: boolean;
  activityCount: number;
}

interface ApiAdminCity {
  id: string;
  name: string;
  country: string;
  region: string | null;
  cost_index: number;
  popularity_score: number;
  image_url: string | null;
  description: string | null;
  tags: string[];
  best_season: string | null;
  avg_daily_cost: string | null;
  is_active: boolean;
  activity_count: number;
}

function toAdminCity(city: ApiAdminCity): AdminCity {
  return {
    id: city.id,
    name: city.name,
    country: city.country,
    region: city.region ?? undefined,
    costIndex: city.cost_index,
    popularityScore: city.popularity_score,
    imageUrl: city.image_url ?? undefined,
    description: city.description ?? undefined,
    tags: city.tags,
    bestSeason: city.best_season ?? undefined,
    avgDailyCost: city.avg_daily_cost === null ? undefined : Number(city.avg_daily_cost),
    isActive: city.is_active,
    activityCount: city.activity_count,
  };
}

export interface CityInput {
  name: string;
  country: string;
  region?: string;
  costIndex: number;
  popularityScore?: number;
  imageUrl?: string;
  description?: string;
  tags?: string[];
  bestSeason?: string;
  avgDailyCost?: number;
  isActive?: boolean;
}

function cityBody(input: Partial<CityInput>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (input.name !== undefined) body.name = input.name;
  if (input.country !== undefined) body.country = input.country;
  if (input.region !== undefined) body.region = input.region || null;
  if (input.costIndex !== undefined) body.cost_index = input.costIndex;
  if (input.popularityScore !== undefined) body.popularity_score = input.popularityScore;
  if (input.imageUrl !== undefined) body.image_url = input.imageUrl || null;
  if (input.description !== undefined) body.description = input.description || null;
  if (input.tags !== undefined) body.tags = input.tags;
  if (input.bestSeason !== undefined) body.best_season = input.bestSeason || null;
  if (input.avgDailyCost !== undefined)
    body.avg_daily_cost = input.avgDailyCost === null ? null : input.avgDailyCost.toFixed(2);
  if (input.isActive !== undefined) body.is_active = input.isActive;
  return body;
}

/** Includes hidden rows — the public `/cities` filters them out, so this is the
 *  only way to find a retired city in order to bring it back. */
export async function getAdminCities(
  query: { page?: number; limit?: number; search?: string } = {}
): Promise<{ cities: AdminCity[]; meta: PageMeta | null }> {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    limit: String(query.limit ?? 20),
  });
  if (query.search) params.set("search", query.search);
  const { data, meta } = await apiFetchPage<ApiAdminCity[]>(`/api/v1/admin/cities?${params}`);
  return { cities: data.map(toAdminCity), meta };
}

export async function createCity(input: CityInput): Promise<AdminCity> {
  return toAdminCity(
    await apiFetch<ApiAdminCity>("/api/v1/admin/cities", {
      method: "POST",
      body: JSON.stringify(cityBody(input)),
    })
  );
}

export async function updateCity(
  cityId: string,
  input: Partial<CityInput>
): Promise<AdminCity> {
  return toAdminCity(
    await apiFetch<ApiAdminCity>(`/api/v1/admin/cities/${cityId}`, {
      method: "PATCH",
      body: JSON.stringify(cityBody(input)),
    })
  );
}

export const ACTIVITY_CATEGORIES = [
  "SIGHTSEEING",
  "FOOD",
  "ADVENTURE",
  "CULTURE",
  "NIGHTLIFE",
  "SHOPPING",
  "RELAXATION",
  "TRANSPORT",
] as const;

export type AdminActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export interface AdminActivity {
  id: string;
  cityId: string;
  cityName: string;
  name: string;
  category: AdminActivityCategory;
  estimatedCost: number;
  currency: string;
  durationMinutes?: number;
  imageUrl?: string;
  description?: string;
  isActive: boolean;
}

interface ApiAdminActivity {
  id: string;
  city_id: string;
  city_name: string;
  name: string;
  category: AdminActivityCategory;
  estimated_cost: string;
  currency: string;
  duration_minutes: number | null;
  image_url: string | null;
  description: string | null;
  is_active: boolean;
}

function toAdminActivity(activity: ApiAdminActivity): AdminActivity {
  return {
    id: activity.id,
    cityId: activity.city_id,
    cityName: activity.city_name,
    name: activity.name,
    category: activity.category,
    estimatedCost: Number(activity.estimated_cost),
    currency: activity.currency,
    durationMinutes: activity.duration_minutes ?? undefined,
    imageUrl: activity.image_url ?? undefined,
    description: activity.description ?? undefined,
    isActive: activity.is_active,
  };
}

export interface ActivityInput {
  cityId: string;
  name: string;
  category: AdminActivityCategory;
  estimatedCost: number;
  currency?: string;
  durationMinutes?: number;
  imageUrl?: string;
  description?: string;
  isActive?: boolean;
}

function activityBody(input: Partial<ActivityInput>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (input.cityId !== undefined) body.city_id = input.cityId;
  if (input.name !== undefined) body.name = input.name;
  if (input.category !== undefined) body.category = input.category;
  if (input.estimatedCost !== undefined) body.estimated_cost = input.estimatedCost.toFixed(2);
  if (input.currency !== undefined) body.currency = input.currency;
  if (input.durationMinutes !== undefined)
    body.duration_minutes = input.durationMinutes || null;
  if (input.imageUrl !== undefined) body.image_url = input.imageUrl || null;
  if (input.description !== undefined) body.description = input.description || null;
  if (input.isActive !== undefined) body.is_active = input.isActive;
  return body;
}

export async function getAdminActivities(
  query: { page?: number; limit?: number; search?: string; cityId?: string } = {}
): Promise<{ activities: AdminActivity[]; meta: PageMeta | null }> {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    limit: String(query.limit ?? 20),
  });
  if (query.search) params.set("search", query.search);
  if (query.cityId) params.set("city_id", query.cityId);
  const { data, meta } = await apiFetchPage<ApiAdminActivity[]>(
    `/api/v1/admin/activities?${params}`
  );
  return { activities: data.map(toAdminActivity), meta };
}

export async function createActivity(input: ActivityInput): Promise<AdminActivity> {
  return toAdminActivity(
    await apiFetch<ApiAdminActivity>("/api/v1/admin/activities", {
      method: "POST",
      body: JSON.stringify(activityBody(input)),
    })
  );
}

export async function updateActivity(
  activityId: string,
  input: Partial<ActivityInput>
): Promise<AdminActivity> {
  return toAdminActivity(
    await apiFetch<ApiAdminActivity>(`/api/v1/admin/activities/${activityId}`, {
      method: "PATCH",
      body: JSON.stringify(activityBody(input)),
    })
  );
}
