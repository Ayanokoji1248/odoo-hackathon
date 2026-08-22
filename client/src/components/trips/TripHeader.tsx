"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, MapPin, Share2, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { tripStatusMeta } from "@/lib/constants/status";
import { formatDateRange } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { Trip } from "@/types";

export function TripHeader({ trip }: { trip: Trip }) {
  const pathname = usePathname();
  const { toast } = useToast();
  const status = tripStatusMeta[trip.status];
  const base = `/trips/${trip.id}`;

  const tabs = [
    { label: "Overview", href: base },
    { label: "Itinerary", href: `${base}/itinerary` },
    { label: "Calendar", href: `${base}/calendar` },
    { label: "Budget", href: `${base}/budget` },
  ];

  return (
    <div>
      <div className="relative h-52 overflow-hidden rounded-3xl sm:h-64">
        <Image
          src={trip.coverImage}
          alt={trip.name}
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-linear-to-t from-slate-900/80 via-slate-900/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-6 text-white sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Badge variant={status.variant} className="mb-2">{status.label}</Badge>
            <h1 className="text-h1 font-bold">{trip.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/90">
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {(trip.cityNames ?? trip.stops.map((s) => s.cityName)).join(" → ")}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {formatDateRange(trip.startDate, trip.endDate)}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-white/40 bg-white/10 text-white backdrop-blur hover:bg-white/20"
              onClick={() => toast("Share link copied to clipboard", "success")}
            >
              <Share2 className="h-4 w-4" /> Share
            </Button>
            <Link href={`${base}/itinerary`}>
              <Button size="sm" className="bg-white text-primary-hover hover:bg-white/90">
                <Pencil className="h-4 w-4" /> Edit
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-1 overflow-x-auto border-b border-border scrollbar-thin">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "relative whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors",
                active ? "text-primary" : "text-text-secondary hover:text-text-primary"
              )}
            >
              {tab.label}
              {active && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
