"use client";

import { useCallback, useEffect, useState } from "react";
import { Users, MapPinned, Building2, Wallet } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { AdminCharts } from "@/components/admin/AdminCharts";
import { ManageUsers } from "@/components/admin/ManageUsers";
import { ManageCatalog } from "@/components/admin/ManageCatalog";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  getStats,
  getTopActivities,
  getTopCities,
  type AdminStats,
  type TopActivity,
  type TopCity,
} from "@/lib/api/admin";
import { formatCurrency, pluralize } from "@/lib/utils/format";

interface Data {
  stats: AdminStats;
  topCities: TopCity[];
  topActivities: TopActivity[];
}

export default function AdminPage() {
  const [data, setData] = useState<Data | null | undefined>(undefined);

  // Catalog edits move the hidden/total counters, and user changes move the
  // headline numbers, so both panels below call this when they mutate anything.
  const load = useCallback(
    () =>
      Promise.all([getStats(), getTopCities(6), getTopActivities(6)])
        .then(([stats, topCities, topActivities]) =>
          setData({ stats, topCities, topActivities })
        )
        .catch(() => setData(null)),
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  if (data === undefined) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-black/5" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-black/5" />
      </div>
    );
  }

  if (data === null) {
    return (
      <Card>
        <ErrorState
          title="Could not load the admin data"
          description="Every /api/v1/admin route requires an admin role. If you were just demoted, sign in again."
          onRetry={load}
        />
      </Card>
    );
  }

  const { stats } = data;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-h1 text-text-primary">Admin panel</h1>
        <p className="mt-1 text-text-secondary">
          Platform health, the catalogue travellers pick from, and account access.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Users"
          value={stats.usersTotal.toLocaleString()}
          icon={Users}
          tone="primary"
          hint={`${stats.usersActive} active · ${pluralize(stats.adminsTotal, "admin")}`}
        />
        <StatCard
          label="Trips"
          value={stats.tripsTotal.toLocaleString()}
          icon={MapPinned}
          tone="info"
          hint={`${stats.avgStopsPerTrip} stops per trip on average`}
        />
        <StatCard
          label="Catalogue"
          value={`${stats.citiesTotal} / ${stats.activitiesTotal}`}
          icon={Building2}
          tone="secondary"
          hint={
            stats.citiesHidden + stats.activitiesHidden > 0
              ? `cities / activities · ${stats.citiesHidden + stats.activitiesHidden} hidden`
              : "cities / activities · none hidden"
          }
        />
        <StatCard
          label="Avg trip budget"
          value={formatCurrency(stats.avgTripBudget, stats.currency)}
          icon={Wallet}
          tone="success"
          hint="Activities x travellers, plus manual costs"
        />
      </div>

      <div className="mb-8">
        <ManageCatalog onChanged={load} />
      </div>

      <div className="mb-8">
        <ManageUsers onChanged={load} />
      </div>

      <h2 className="mb-4 text-h2 text-text-primary">Trends &amp; analytics</h2>
      <AdminCharts
        stats={stats}
        topCities={data.topCities}
        topActivities={data.topActivities}
      />
    </div>
  );
}
