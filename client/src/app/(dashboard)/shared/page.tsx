import Image from "next/image";
import Link from "next/link";
import { Eye, Copy, ArrowRight, Share2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { mockTrips } from "@/data/mock/trips";
import { formatCurrency, formatDateRange, daysBetween, pluralize } from "@/lib/utils/format";

export default function SharedTripsPage() {
  const publicTrips = mockTrips.filter((t) => t.isPublic && t.shareToken);

  return (
    <div>
      <PageHeader title="Shared Trips" subtitle="Public itineraries you can explore and copy." />

      {publicTrips.length === 0 ? (
        <EmptyState icon={Share2} title="No shared trips yet" description="Make a trip public to share it with the world." />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {publicTrips.map((trip) => (
            <Link
              key={trip.id}
              href={`/shared/${trip.shareToken}`}
              className="group overflow-hidden rounded-2xl border border-border bg-surface shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover"
            >
              <div className="relative h-40 overflow-hidden">
                <Image src={trip.coverImage} alt={trip.name} fill sizes="33vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-linear-to-t from-slate-900/60 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <h3 className="text-h4 font-bold">{trip.name}</h3>
                  <p className="text-sm text-white/85">{trip.stops.map((s) => s.cityName).join(" → ")}</p>
                </div>
              </div>
              <div className="p-4">
                <p className="text-sm text-text-secondary">
                  {formatDateRange(trip.startDate, trip.endDate)} ·{" "}
                  {pluralize(daysBetween(trip.startDate, trip.endDate), "day")}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex gap-3 text-caption text-text-muted">
                    <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />1.2k</span>
                    <span className="flex items-center gap-1"><Copy className="h-3.5 w-3.5" />47</span>
                  </div>
                  <Badge variant="primary">{formatCurrency(trip.estimatedBudget)}</Badge>
                </div>
                <span className="mt-3 flex items-center gap-1 text-sm font-medium text-primary">
                  View itinerary <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
