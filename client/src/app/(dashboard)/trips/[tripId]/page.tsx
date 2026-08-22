import Image from "next/image";
import { notFound } from "next/navigation";
import { CalendarDays, Building2, Compass, Wallet } from "lucide-react";
import { TripHeader } from "@/components/trips/TripHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getTripById } from "@/data/mock/trips";
import { getCityById } from "@/data/mock/cities";
import { formatCurrency, formatDateRange, daysBetween, pluralize } from "@/lib/utils/format";

export default async function TripOverviewPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const trip = getTripById(tripId);
  if (!trip) notFound();

  const days = daysBetween(trip.startDate, trip.endDate);

  return (
    <div>
      <TripHeader trip={trip} />

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Duration" value={pluralize(days, "Day")} icon={CalendarDays} tone="primary" />
        <StatCard label="Cities" value={String(trip.stops.length)} icon={Building2} tone="info" />
        <StatCard label="Activities" value={String(trip.activityCount)} icon={Compass} tone="secondary" />
        <StatCard label="Est. Budget" value={formatCurrency(trip.estimatedBudget)} icon={Wallet} tone="success" />
      </div>

      {trip.description && (
        <Card className="mt-6">
          <h2 className="text-h4 text-text-primary">About this trip</h2>
          <p className="mt-2 text-text-secondary">{trip.description}</p>
        </Card>
      )}

      <div className="mt-6">
        <h2 className="mb-4 text-h2 text-text-primary">Trip Stops</h2>
        <div className="space-y-4">
          {trip.stops.map((stop, i) => {
            const city = getCityById(stop.cityId);
            return (
              <Card key={stop.id} padded={false} className="flex overflow-hidden">
                <div className="relative hidden w-40 shrink-0 sm:block">
                  <Image src={stop.imageUrl} alt={stop.cityName} fill className="object-cover" sizes="160px" />
                </div>
                <div className="flex-1 p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-light text-xs font-bold text-primary-hover">
                          {i + 1}
                        </span>
                        <h3 className="text-h4 text-text-primary">{stop.cityName}</h3>
                      </div>
                      <p className="mt-0.5 text-sm text-text-secondary">{stop.country}</p>
                    </div>
                    {city && <Badge variant="outline">{city.costIndex}</Badge>}
                  </div>
                  <p className="mt-2 text-sm text-text-secondary">
                    {formatDateRange(stop.startDate, stop.endDate)} ·{" "}
                    {pluralize(daysBetween(stop.startDate, stop.endDate), "day")}
                  </p>
                  {city && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {city.tags.slice(0, 4).map((t) => (
                        <Badge key={t}>{t}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
