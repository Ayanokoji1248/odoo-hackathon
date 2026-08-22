import type { SharedTrip, Trip } from "@/types";
import { apiFetch, ApiError } from "./client";
import { toTrip, type ApiTrip } from "./trips";
import { toBudget, type ApiBudget } from "./budget";
import { toItinerary } from "./itinerary";

export interface ShareState {
  isPublic: boolean;
  shareSlug?: string;
}

interface ApiShareState {
  is_public: boolean;
  share_slug: string | null;
}

function toShareState(state: ApiShareState): ShareState {
  return { isPublic: state.is_public, shareSlug: state.share_slug ?? undefined };
}

/**
 * Idempotent on the server: calling it again returns the same slug, so a link
 * already sent to someone keeps working.
 */
export async function shareTrip(tripId: string): Promise<ShareState> {
  return toShareState(
    await apiFetch<ApiShareState>(`/api/v1/trips/${tripId}/share`, { method: "POST" })
  );
}

/**
 * Kills the link permanently — the slug is cleared, not just the flag. Sharing
 * again mints a new one, so nobody who saw the old link gets access back.
 */
export async function unshareTrip(tripId: string): Promise<ShareState> {
  return toShareState(
    await apiFetch<ApiShareState>(`/api/v1/trips/${tripId}/share`, { method: "DELETE" })
  );
}

/** The absolute link to hand out. The API only knows the slug; the origin is ours. */
export function shareUrl(slug: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/shared/${slug}`;
}

interface ApiPublicTrip extends ApiTrip {
  owner_name: string;
  copy_count: number;
}

/**
 * The read-only public view. Two calls because the budget is computed, not stored
 * — same split the owner's own budget page uses.
 *
 * `undefined` means "no public trip at that link", which covers both a slug that
 * never existed and one whose owner has since un-shared it. The API returns 404
 * for both on purpose: a 403 would confirm the trip exists.
 */
export async function getSharedTrip(slug: string): Promise<SharedTrip | undefined> {
  try {
    const [trip, budget] = await Promise.all([
      apiFetch<ApiPublicTrip>(`/api/v1/public/trips/${slug}`),
      apiFetch<ApiBudget>(`/api/v1/public/trips/${slug}/budget`),
    ]);
    return {
      shareToken: slug,
      trip: toTrip(trip),
      itinerary: toItinerary(trip),
      budget: toBudget(trip.id, budget),
      ownerName: trip.owner_name,
      copies: trip.copy_count,
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return undefined;
    throw error;
  }
}

/**
 * Deep-copies the trip into the signed-in user's account: stops, activities and
 * budget items, with every date rebased while keeping its relative offset.
 *
 * Throws a 401 when nobody is signed in — the copy needs an owner.
 */
export async function copySharedTrip(slug: string, startDate?: string): Promise<Trip> {
  return toTrip(
    await apiFetch<ApiTrip>(`/api/v1/public/trips/${slug}/copy`, {
      method: "POST",
      body: JSON.stringify(startDate ? { start_date: startDate } : {}),
    })
  );
}
