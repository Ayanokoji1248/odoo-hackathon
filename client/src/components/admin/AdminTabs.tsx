"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { Users, Building2, Compass, LineChart } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ManageUsers } from "@/components/admin/ManageUsers";
import {
  tripsCreated, userGrowth, popularCities, popularActivities, usersByRegion,
} from "@/data/mock/admin";
import { cn } from "@/lib/utils/cn";

const axis = { fontSize: 11, fill: "#94a3b8" };
const PIE_COLORS = ["#0d9488", "#2563eb", "#f59e0b", "#c70032"];

const TABS = [
  { key: "analytics", label: "User Trends & Analytics", icon: LineChart },
  { key: "users", label: "Manage Users", icon: Users },
  { key: "cities", label: "Popular Cities", icon: Building2 },
  { key: "activities", label: "Popular Activities", icon: Compass },
];

export function AdminTabs() {
  const [tab, setTab] = useState("analytics");

  return (
    <div>
      {/* Tab buttons (wireframe style) */}
      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors",
                active
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-surface text-text-secondary hover:border-primary/50 hover:text-text-primary"
              )}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "analytics" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <h3 className="mb-4 text-h4 text-text-primary">Trips Created</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={tripsCreated} margin={{ left: -10 }}>
                  <defs>
                    <linearGradient id="a1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0d9488" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#0d9488" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="month" tick={axis} axisLine={false} tickLine={false} />
                  <YAxis tick={axis} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip />
                  <Area type="monotone" dataKey="trips" stroke="#0d9488" strokeWidth={2} fill="url(#a1)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <h3 className="mb-4 text-h4 text-text-primary">User Growth</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={userGrowth} margin={{ left: -10 }}>
                  <defs>
                    <linearGradient id="a2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="month" tick={axis} axisLine={false} tickLine={false} />
                  <YAxis tick={axis} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip />
                  <Area type="monotone" dataKey="users" stroke="#2563eb" strokeWidth={2} fill="url(#a2)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <h3 className="mb-4 text-h4 text-text-primary">Users by Region</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={usersByRegion} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                    {usersByRegion.map((e, i) => <Cell key={e.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => Number(v).toLocaleString()} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <h3 className="mb-4 text-h4 text-text-primary">Bookings Overview</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tripsCreated} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="month" tick={axis} axisLine={false} tickLine={false} />
                  <YAxis tick={axis} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip cursor={{ fill: "#f1f5f9" }} />
                  <Bar dataKey="trips" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {tab === "users" && <ManageUsers />}

      {tab === "cities" && (
        <Card>
          <h3 className="mb-4 text-h4 text-text-primary">Popular Cities</h3>
          <p className="mb-4 text-sm text-text-secondary">Most-visited cities based on current user trends.</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={popularCities} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={axis} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                <YAxis type="category" dataKey="name" tick={axis} axisLine={false} tickLine={false} width={70} />
                <Tooltip cursor={{ fill: "#f1f5f9" }} />
                <Bar dataKey="trips" fill="#0d9488" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {tab === "activities" && (
        <Card>
          <h3 className="mb-4 text-h4 text-text-primary">Popular Activities</h3>
          <p className="mb-4 text-sm text-text-secondary">Most-booked activities based on current user trends.</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={popularActivities} layout="vertical" margin={{ left: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={axis} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                <YAxis type="category" dataKey="name" tick={axis} axisLine={false} tickLine={false} width={100} />
                <Tooltip cursor={{ fill: "#f1f5f9" }} />
                <Bar dataKey="count" fill="#c70032" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
}
