"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, MapPin, MoreVertical, Pencil, Share2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { useToast } from "@/components/ui/Toast";
import { tripStatusMeta } from "@/lib/constants/status";
import { formatCurrency, formatDateRange, daysBetween, pluralize } from "@/lib/utils/format";
import type { Trip } from "@/types";

export function TripCard({ trip }: { trip: Trip }) {
  const router = useRouter();
  const { toast } = useToast();
  const status = tripStatusMeta[trip.status];
  const route = trip.stops.map((s) => s.cityName).join(" → ");
  const days = daysBetween(trip.startDate, trip.endDate);

  return (
    <div className="group overflow-hidden rounded-2xl border border-border bg-surface shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover">
      <Link href={`/trips/${trip.id}`} className="relative block h-44 overflow-hidden">
        <Image
          src={trip.coverImage}
          alt={trip.name}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-linear-to-t from-slate-900/50 to-transparent" />
        <div className="absolute left-3 top-3">
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        {/* Days badge on image — reference card pattern */}
        <span className="absolute bottom-2.5 right-2.5 rounded-md border border-white/70 bg-white px-2 py-0.5 text-[13px] font-semibold text-secondary shadow-sm">
          {pluralize(days, "Day")}
        </span>
      </Link>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/trips/${trip.id}`} className="min-w-0">
            <h3 className="truncate text-h4 text-text-primary group-hover:text-primary">
              {trip.name}
            </h3>
          </Link>
          <Dropdown
            trigger={
              <span className="rounded-lg p-1.5 text-text-muted hover:bg-surface-muted hover:text-text-primary">
                <MoreVertical className="h-4 w-4" />
              </span>
            }
          >
            <DropdownItem onClick={() => router.push(`/trips/${trip.id}/itinerary`)}>
              <Pencil className="h-4 w-4" /> Edit itinerary
            </DropdownItem>
            <DropdownItem onClick={() => toast("Share link copied to clipboard", "success")}>
              <Share2 className="h-4 w-4" /> Share
            </DropdownItem>
            <DropdownItem danger onClick={() => toast("Trip deleted", "info")}>
              <Trash2 className="h-4 w-4" /> Delete
            </DropdownItem>
          </Dropdown>
        </div>

        <p className="mt-1 flex items-center gap-1 truncate text-sm text-text-secondary">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          {route}
        </p>

        <div className="mt-3 flex items-center gap-1.5 text-sm text-text-secondary">
          <Calendar className="h-3.5 w-3.5" />
          {formatDateRange(trip.startDate, trip.endDate)}
        </div>
        <p className="mt-1 text-caption text-text-muted">
          {pluralize(days, "Day")} · {pluralize(trip.stops.length, "City", "Cities")} ·{" "}
          {pluralize(trip.activityCount, "Activity", "Activities")}
        </p>

        <div className="mt-4 flex items-center justify-between border-t border-dashed border-[#e6e6e6] pt-3">
          <div>
            <p className="text-caption text-text-muted">Estimated</p>
            <p className="text-lg font-extrabold leading-tight text-secondary">
              {formatCurrency(trip.estimatedBudget)}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => router.push(`/trips/${trip.id}`)}>
            View Trip
          </Button>
        </div>
      </div>
    </div>
  );
}
