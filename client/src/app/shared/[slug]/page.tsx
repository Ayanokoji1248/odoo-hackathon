import { notFound } from "next/navigation";
import { PublicTripStory } from "@/components/share/PublicTripStory";
import { getSharedTrip } from "@/lib/api/shares";

/**
 * The read-only public view — the only page in the app that renders someone
 * else's trip, and the only one that works with no session at all.
 *
 * A server component on purpose: `/public/trips/{slug}` needs no cookie, so there
 * is nothing to forward, and rendering on the server means a link pasted into a
 * chat app gets real HTML instead of a loading spinner.
 */
export default async function SharedTripPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const shared = await getSharedTrip(slug);
  // Covers a slug that never existed and one whose owner has un-shared it. The
  // API answers 404 to both so a prober learns nothing either way.
  if (!shared) notFound();

  return <PublicTripStory shared={shared} />;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const shared = await getSharedTrip(slug).catch(() => undefined);
  if (!shared) return { title: "Trip not found" };
  return {
    title: `${shared.trip.name} · GlobeTrotter`,
    description:
      shared.trip.description ??
      `A ${shared.trip.durationDays}-day itinerary through ${(
        shared.trip.cityNames ?? []
      ).join(", ")}.`,
  };
}
