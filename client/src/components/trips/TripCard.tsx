"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Calendar, MapPin, MoreVertical, Pencil, Route, Share2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { TripDeleteDialog, TripEditDialog } from "./TripEditDialog";
import { ShareDialog } from "@/components/share/ShareDialog";
import { tripStatusMeta } from "@/lib/constants/status";
import { formatCurrency, formatDateRange, daysBetween, pluralize } from "@/lib/utils/format";
import type { Trip } from "@/types";

/** `onChanged` refetches the owning list after an edit or a delete - simpler and
 *  less wrong than splicing the card out of a copy of the parent's state. */
export function TripCard({ trip, onChanged }: { trip: Trip; onChanged?: () => void }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const status = tripStatusMeta[trip.status];
  // List responses carry city names only; detail responses carry full stops.
  const cities = trip.cityNames ?? trip.stops.map((s) => s.cityName);
  const route = cities.join(" → ");
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

      <div className="p-5">
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
            <DropdownItem onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" /> Edit details
            </DropdownItem>
            <DropdownItem onClick={() => router.push(`/trips/${trip.id}/itinerary`)}>
              <Route className="h-4 w-4" /> Edit itinerary
            </DropdownItem>
            <DropdownItem onClick={() => setSharing(true)}>
              <Share2 className="h-4 w-4" /> {trip.isPublic ? "Sharing" : "Share"}
            </DropdownItem>
            <DropdownItem danger onClick={() => setDeleting(true)}>
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
          {pluralize(days, "Day")} · {pluralize(cities.length, "City", "Cities")} ·{" "}
          {pluralize(trip.activityCount, "Activity", "Activities")}
        </p>

        <div className="mt-4 border-t border-dashed border-[#e6e6e6] pt-3">
          <p className="text-caption text-text-muted">Estimated total</p>
          <p className="text-2xl font-extrabold leading-none text-secondary">
            {formatCurrency(trip.estimatedBudget)}
          </p>
        </div>
        <Button size="sm" className="mt-3 w-full" onClick={() => router.push(`/trips/${trip.id}`)}>
          View Trip
        </Button>
      </div>

      {editing && (
        <TripEditDialog trip={trip} onClose={() => setEditing(false)} onSaved={onChanged} />
      )}
      {deleting && (
        <TripDeleteDialog trip={trip} onClose={() => setDeleting(false)} onDeleted={onChanged} />
      )}
      {sharing && (
        <ShareDialog trip={trip} onClose={() => setSharing(false)} onChanged={onChanged} />
      )}
    </div>
  );
}
