"use client";

import Link from "next/link";
import { MapPin, Mail, Phone, Calendar, Pencil } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { TripCard } from "@/components/trips/TripCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { MapPinned } from "lucide-react";
import { useUser } from "@/lib/auth/AuthProvider";
import { mockTrips } from "@/data/mock/trips";
import { formatDate } from "@/lib/utils/format";

export default function ProfilePage() {
  const user = useUser();
  // Trips are still mock data — there is no /trips endpoint on the API yet.
  const preplanned = mockTrips.filter((t) => t.status === "upcoming" || t.status === "ongoing" || t.status === "draft");
  const previous = mockTrips.filter((t) => t.status === "completed");

  return (
    <div>
      <PageHeader title="Profile" />

      {/* User header */}
      <Card className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <Avatar name={user.name} src={user.avatarUrl} size="lg" className="h-24 w-24 text-2xl" />
        <div className="flex-1">
          <h2 className="text-h2 text-text-primary">{user.name}</h2>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-text-secondary">
            <span className="flex items-center gap-1.5"><Mail className="h-4 w-4" />{user.email}</span>
            {user.phone && <span className="flex items-center gap-1.5"><Phone className="h-4 w-4" />{user.phone}</span>}
            {user.location && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{user.location}</span>}
            <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" />Joined {formatDate(user.memberSince, { month: "long", year: "numeric" })}</span>
          </div>
          {user.bio && <p className="mt-3 max-w-2xl text-text-secondary">{user.bio}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {user.preferences.travelStyle.map((s) => (
              <Badge key={s} variant="primary">{s}</Badge>
            ))}
          </div>
        </div>
        <Link href="/settings">
          <Button variant="outline"><Pencil className="h-4 w-4" /> Edit Profile</Button>
        </Link>
      </Card>

      {/* Preplanned Trips */}
      <section className="mt-8">
        <SectionHeading title="Preplanned Trips" href="/trips" />
        {preplanned.length === 0 ? (
          <EmptyState icon={MapPinned} title="No planned trips" description="Plan your next adventure to see it here." />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {preplanned.map((t) => <TripCard key={t.id} trip={t} />)}
          </div>
        )}
      </section>

      {/* Previous Trips */}
      <section className="mt-8">
        <SectionHeading title="Previous Trips" href="/trips" />
        {previous.length === 0 ? (
          <EmptyState icon={MapPinned} title="No previous trips yet" description="Your completed trips will appear here." />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {previous.map((t) => <TripCard key={t.id} trip={t} />)}
          </div>
        )}
      </section>
    </div>
  );
}
