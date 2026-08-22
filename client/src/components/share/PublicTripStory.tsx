"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Copy, Share2, MapPin, CalendarDays, Wallet, Clock, Eye } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { getCategoryMeta } from "@/lib/constants/categories";
import {
  formatCurrency,
  formatDate,
  formatDateRange,
  daysBetween,
  pluralize,
} from "@/lib/utils/format";
import type { SharedTrip } from "@/types";

export function PublicTripStory({ shared }: { shared: SharedTrip }) {
  const router = useRouter();
  const { toast } = useToast();
  const { trip, itinerary, budget } = shared;
  const days = daysBetween(trip.startDate, trip.endDate);
  const totalCost = budget.lines.reduce((s, l) => s + (l.actual ?? l.planned), 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Minimal top bar */}
      <div className="flex items-center justify-between px-5 py-4 lg:px-10">
        <Logo href="/dashboard" size="sm" />
        <Button variant="outline" size="sm" onClick={() => router.push("/login")}>
          Create your own
        </Button>
      </div>

      {/* Hero */}
      <div className="relative mx-auto max-w-5xl px-5 lg:px-0">
        <div className="relative h-72 overflow-hidden rounded-3xl sm:h-96">
          <Image src={trip.coverImage} alt={trip.name} fill priority className="object-cover" sizes="100vw" />
          <div className="absolute inset-0 bg-linear-to-t from-slate-900/85 via-slate-900/30 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-10">
            <Badge variant="primary" className="mb-3">Public Itinerary</Badge>
            <h1 className="text-display font-bold">{trip.name}</h1>
            <p className="mt-2 flex items-center gap-2 text-white/90">
              <MapPin className="h-4 w-4" />
              {trip.stops.map((s) => s.cityName).join(" → ")}
            </p>
          </div>
        </div>
      </div>

      {/* Meta row */}
      <div className="mx-auto mt-6 max-w-5xl px-5 lg:px-0">
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Avatar name={shared.ownerName} src={shared.ownerAvatar} />
            <div>
              <p className="text-sm text-text-muted">Curated by</p>
              <p className="font-semibold text-text-primary">{shared.ownerName}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-5 text-sm">
            <span className="flex items-center gap-1.5 text-text-secondary"><CalendarDays className="h-4 w-4 text-primary" />{formatDateRange(trip.startDate, trip.endDate)}</span>
            <span className="flex items-center gap-1.5 text-text-secondary"><Clock className="h-4 w-4 text-primary" />{pluralize(days, "Day")}</span>
            <span className="flex items-center gap-1.5 text-text-secondary"><Wallet className="h-4 w-4 text-primary" />{formatCurrency(totalCost)}</span>
            <span className="flex items-center gap-1.5 text-text-muted"><Eye className="h-4 w-4" />{shared.views.toLocaleString()} views</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mx-auto mt-6 flex max-w-5xl gap-3 px-5 lg:px-0">
        <Button className="flex-1 sm:flex-none" onClick={() => toast("Trip copied to your account! 🎉", "success")}>
          <Copy className="h-4 w-4" /> Copy This Trip
        </Button>
        <Button variant="outline" onClick={() => toast("Share link copied", "success")}>
          <Share2 className="h-4 w-4" /> Share
        </Button>
      </div>

      {/* Overview description */}
      {trip.description && (
        <div className="mx-auto mt-8 max-w-5xl px-5 lg:px-0">
          <h2 className="text-h2 text-text-primary">Trip Overview</h2>
          <p className="mt-2 max-w-3xl text-body-lg text-text-secondary">{trip.description}</p>
        </div>
      )}

      {/* Day-by-day, grouped by stop */}
      <div className="mx-auto mt-8 max-w-5xl space-y-10 px-5 pb-20 lg:px-0">
        {trip.stops.map((stop, si) => {
          const stopDays = itinerary.days.filter((d) => d.stopId === stop.id);
          return (
            <section key={stop.id}>
              <div className="mb-4 flex items-center gap-3">
                <div className="relative h-12 w-12 overflow-hidden rounded-xl">
                  <Image src={stop.imageUrl} alt={stop.cityName} fill className="object-cover" sizes="48px" />
                </div>
                <div>
                  <h3 className="text-h2 text-text-primary">
                    {si + 1}. {stop.cityName}
                  </h3>
                  <p className="text-sm text-text-secondary">
                    {stop.country} · {formatDateRange(stop.startDate, stop.endDate)}
                  </p>
                </div>
              </div>

              {stopDays.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-4 text-sm text-text-muted">
                  No activities listed for this stop.
                </p>
              ) : (
                <div className="space-y-6">
                  {stopDays.map((day, i) => (
                    <div key={day.id} className="rounded-2xl border border-border bg-surface p-5">
                      <p className="mb-3 text-caption font-semibold uppercase tracking-wider text-primary">
                        {formatDate(day.date, { weekday: "long", month: "short", day: "numeric" })}
                        {i === 0 && si === 0 ? " · Arrival" : ""}
                      </p>
                      <ul className="space-y-3">
                        {day.items.map((item) => {
                          const meta = getCategoryMeta(item.category);
                          return (
                            <li key={item.id} className="flex items-start gap-3">
                              <span className="w-12 shrink-0 pt-1 text-sm font-semibold text-text-secondary">{item.time}</span>
                              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.color}`}>
                                <meta.icon className="h-4 w-4" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-text-primary">{item.title}</p>
                                {item.notes && <p className="text-caption text-text-secondary">{item.notes}</p>}
                              </div>
                              <span className="whitespace-nowrap text-sm text-text-muted">
                                {item.cost === 0 ? "Free" : formatCurrency(item.cost)}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}

        <div className="rounded-3xl bg-primary p-8 text-center text-white">
          <h3 className="text-h2">Love this itinerary?</h3>
          <p className="mt-1 text-white/85">Copy it to your account and make it your own.</p>
          <Button className="mt-4 bg-white text-primary-hover hover:bg-white/90" onClick={() => toast("Trip copied to your account! 🎉", "success")}>
            <Copy className="h-4 w-4" /> Copy This Trip
          </Button>
        </div>
      </div>
    </div>
  );
}
