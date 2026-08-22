"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { BarChart3 } from "lucide-react";
import { formatDate } from "@/lib/utils/format";
import type { AdminStats, TopActivity, TopCity } from "@/lib/api/admin";

const axis = { fontSize: 11, fill: "#94a3b8" };

/** Whole numbers only: these are counts of rows, so "1.5 users" is nonsense. */
const countTick = (value: number) => (Number.isInteger(value) ? String(value) : "");

function monthLabel(iso: string): string {
  return formatDate(iso, { month: "short" });
}

function Panel({
  title,
  hint,
  children,
  empty,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  empty: boolean;
}) {
  return (
    <Card>
      <div className="mb-4">
        <h3 className="text-h4 text-text-primary">{title}</h3>
        {hint && <p className="mt-0.5 text-caption text-text-muted">{hint}</p>}
      </div>
      {empty ? (
        <div className="flex h-56 items-center">
          <EmptyState
            icon={BarChart3}
            title="Nothing to plot yet"
            description="This fills in as people use the platform."
          />
        </div>
      ) : (
        <div className="h-56">{children}</div>
      )}
    </Card>
  );
}

export function AdminCharts({
  stats,
  topCities,
  topActivities,
}: {
  stats: AdminStats;
  topCities: TopCity[];
  topActivities: TopActivity[];
}) {
  const trips = stats.newTripsByMonth.map((p) => ({ month: monthLabel(p.month), trips: p.count }));
  const users = stats.newUsersByMonth.map((p) => ({ month: monthLabel(p.month), users: p.count }));
  const cities = topCities.map((c) => ({ name: c.name, trips: c.tripCount }));
  const activities = topActivities.map((a) => ({ name: a.name, count: a.addCount }));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel
        title="Trips created"
        hint="New trips per month, last 6 months"
        empty={trips.every((t) => t.trips === 0)}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trips} margin={{ left: -10 }}>
            <defs>
              <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0d9488" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#0d9488" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="month" tick={axis} axisLine={false} tickLine={false} />
            <YAxis tick={axis} axisLine={false} tickLine={false} tickFormatter={countTick} allowDecimals={false} />
            <Tooltip />
            <Area type="monotone" dataKey="trips" stroke="#0d9488" strokeWidth={2} fill="url(#g1)" />
          </AreaChart>
        </ResponsiveContainer>
      </Panel>

      <Panel
        title="New users"
        hint="Sign-ups per month, last 6 months"
        empty={users.every((u) => u.users === 0)}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={users} margin={{ left: -10 }}>
            <defs>
              <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="month" tick={axis} axisLine={false} tickLine={false} />
            <YAxis tick={axis} axisLine={false} tickLine={false} tickFormatter={countTick} allowDecimals={false} />
            <Tooltip />
            <Area type="monotone" dataKey="users" stroke="#2563eb" strokeWidth={2} fill="url(#g2)" />
          </AreaChart>
        </ResponsiveContainer>
      </Panel>

      <Panel
        title="Most planned cities"
        hint="Counts real trip stops, not the editorial popularity score"
        empty={cities.length === 0}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={cities} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
            <XAxis type="number" tick={axis} axisLine={false} tickLine={false} tickFormatter={countTick} allowDecimals={false} />
            <YAxis type="category" dataKey="name" tick={axis} axisLine={false} tickLine={false} width={70} />
            <Tooltip cursor={{ fill: "#f1f5f9" }} />
            <Bar dataKey="trips" fill="#f59e0b" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel
        title="Most added activities"
        hint="Catalogue rows only — custom activities have nothing to count against"
        empty={activities.length === 0}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={activities} layout="vertical" margin={{ left: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
            <XAxis type="number" tick={axis} axisLine={false} tickLine={false} tickFormatter={countTick} allowDecimals={false} />
            <YAxis type="category" dataKey="name" tick={axis} axisLine={false} tickLine={false} width={110} />
            <Tooltip cursor={{ fill: "#f1f5f9" }} />
            <Bar dataKey="count" fill="#0d9488" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  );
}
