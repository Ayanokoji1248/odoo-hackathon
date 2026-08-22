"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Copy, ExternalLink, Share2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { ShareDialog } from "@/components/share/ShareDialog";
import { getTrips } from "@/lib/api/trips";
import { shareUrl } from "@/lib/api/shares";
import { formatCurrency, formatDateRange, daysBetween, pluralize } from "@/lib/utils/format";
import type { Trip } from "@/types";

/**
 * The trips *you* have shared, with their links.
 *
 * This used to be a directory of everyone's public trips, off mock data. It is
 * not one now, and that is deliberate: "public by link" is not the same promise as
 * "listed in a browsable feed", and quietly turning one into the other would
 * expose trips their owners only meant to hand to a friend. A real discovery feed
 * needs its own opt-in.
 *
 * What was missing and is genuinely useful: somewhere to find a link again after
 * you have closed the dialog that created it.
 */
export default function SharedTripsPage() {
  const { toast } = useToast();
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [managing, setManaging] = useState<Trip | null>(null);

  const load = useCallback(
    () =>
      getTrips()
        .then((all) => setTrips(all.filter((t) => t.isPublic && t.shareToken)))
        .catch(() => setTrips([])),
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  const copyLink = async (trip: Trip) => {
    try {
      await navigator.clipboard.writeText(shareUrl(trip.shareToken!));
      toast("Link copied", "success");
    } catch {
      toast("Could not reach the clipboard", "error");
    }
  };

  return (
    <div>
      <PageHeader
        title="Shared trips"
        subtitle="Your public itineraries and the links that point at them."
      />

      {trips === null ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-2xl bg-black/5" />
          ))}
        </div>
      ) : trips.length === 0 ? (
        <EmptyState
          icon={Share2}
          title="Nothing shared yet"
          description="Open a trip, hit Share, and create a public link. It will show up here with the link so you can find it again."
          action={
            <Link href="/trips">
              <Button>Go to my trips</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => (
            <div
              key={trip.id}
              className="group overflow-hidden rounded-2xl border border-border bg-surface shadow-card"
            >
              <Link
                href={`/shared/${trip.shareToken}`}
                className="relative block h-40 overflow-hidden"
              >
                <Image
                  src={trip.coverImage}
                  alt={trip.name}
                  fill
                  sizes="33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-linear-to-t from-slate-900/60 to-transparent" />
                <div className="absolute inset-x-3 bottom-3 text-white">
                  <h3 className="text-h4 font-bold">{trip.name}</h3>
                  <p className="truncate text-sm text-white/85">
                    {(trip.cityNames ?? trip.stops.map((s) => s.cityName)).join(" → ")}
                  </p>
                </div>
              </Link>

              <div className="p-4">
                <p className="text-sm text-text-secondary">
                  {formatDateRange(trip.startDate, trip.endDate)} ·{" "}
                  {pluralize(daysBetween(trip.startDate, trip.endDate), "day")}
                </p>

                <div className="mt-3 flex items-center justify-between">
                  <Badge variant="success">public</Badge>
                  <Badge variant="primary">
                    {formatCurrency(trip.estimatedBudget, trip.currency)}
                  </Badge>
                </div>

                <p className="mt-3 truncate rounded-lg bg-surface-muted px-2.5 py-1.5 font-mono text-caption text-text-muted">
                  /shared/{trip.shareToken}
                </p>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={() => copyLink(trip)}>
                    <Copy className="h-4 w-4" /> Copy link
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setManaging(trip)}>
                    <Share2 className="h-4 w-4" /> Manage
                  </Button>
                </div>
                <Link href={`/shared/${trip.shareToken}`} className="mt-2 block">
                  <Button size="sm" className="w-full">
                    <ExternalLink className="h-4 w-4" /> See what viewers see
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {managing && (
        <ShareDialog
          trip={managing}
          onClose={() => setManaging(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
