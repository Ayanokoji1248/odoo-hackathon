"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { Wallet, CalendarDays, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/dashboard/StatCard";
import { formatCurrency, formatDate, daysBetween } from "@/lib/utils/format";
import type { Budget, Trip } from "@/types";

const COLORS: Record<string, string> = {
  Transport: "#0d9488",
  Accommodation: "#2563eb",
  Activities: "#f59e0b",
  Food: "#16a34a",
  Other: "#94a3b8",
  // activity-category labels
  Sightseeing: "#0ea5e9",
  Culture: "#8b5cf6",
  Adventure: "#ef4444",
  Nightlife: "#db2777",
  Shopping: "#f97316",
  Rest: "#14b8a6",
  Relaxation: "#14b8a6",
};

const FALLBACK_COLOR = "#94a3b8";

export function BudgetView({ trip, budget }: { trip: Trip; budget: Budget }) {
  /**
   * Live API budgets are *estimates*: there is no target cap and no actual-spend
   * tracking, so "remaining" and "planned vs actual" have nothing behind them.
   * Mock budgets still carry a cap, so both shapes are handled.
   */
  const live = budget.byCity !== undefined;

  const spent = budget.lines.reduce((s, l) => s + (l.actual ?? l.planned), 0);
  const days = budget.days ?? daysBetween(trip.startDate, trip.endDate);
  const perDay = budget.avgPerDay ?? Math.round(spent / days);
  const currency = budget.currency;

  const remaining = budget.total - spent;
  const overBudget = remaining < 0;
  const overBudgetDays = budget.daily.filter((d) => d.overBudget).length;

  const categoryLines = budget.activityLines?.length ? budget.activityLines : budget.lines;

  const pieData = categoryLines.map((l) => ({
    name: l.category,
    value: l.actual ?? l.planned,
  }));

  const cityData = (budget.byCity ?? []).map((c) => ({
    city: c.cityName,
    amount: c.amount,
  }));

  const barData = budget.lines.map((l) => ({
    category: l.category,
    Planned: l.planned,
    Actual: l.actual ?? 0,
  }));

  const dailyData = budget.daily.map((d) => ({
    date: formatDate(d.date, { month: "short", day: "numeric" }),
    amount: d.amount,
    over: Boolean(d.overBudget),
  }));

  const money = (value: number) => formatCurrency(value, currency);
  const axisMoney = (value: number) =>
    value >= 1000 ? `${Math.round(value / 1000)}k` : String(value);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Estimated Total" value={money(budget.total)} icon={Wallet} tone="primary" />
        <StatCard label="Average / Day" value={money(perDay)} icon={CalendarDays} tone="info" />

        {live ? (
          <>
            <StatCard
              label={`Activities${trip.travelers && trip.travelers > 1 ? ` (x${trip.travelers})` : ""}`}
              value={money(budget.activitiesTotal ?? 0)}
              icon={Wallet}
              tone="secondary"
            />
            <Card className="flex items-center gap-4">
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                  overBudgetDays ? "bg-amber-50 text-amber-600" : "bg-green-50 text-success"
                }`}
              >
                {overBudgetDays ? (
                  <AlertTriangle className="h-6 w-6" />
                ) : (
                  <TrendingDown className="h-6 w-6" />
                )}
              </span>
              <div>
                <p className="text-sm text-text-secondary">Expensive days</p>
                <p className="text-h3 text-text-primary">
                  {overBudgetDays} of {budget.daily.length}
                </p>
              </div>
            </Card>
          </>
        ) : (
          <>
            <StatCard label="Budget Cap" value={money(budget.total)} icon={Wallet} tone="secondary" />
            <Card className="flex items-center gap-4">
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                  overBudget ? "bg-red-50 text-error" : "bg-green-50 text-success"
                }`}
              >
                {overBudget ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
              </span>
              <div>
                <p className="text-sm text-text-secondary">
                  {overBudget ? "Over budget" : "Under budget"}
                </p>
                <p className="text-h3 text-text-primary">{money(Math.abs(remaining))}</p>
              </div>
            </Card>
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Donut */}
        <Card>
          <h3 className="mb-2 text-h4 text-text-primary">Spending by Category</h3>
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="h-56 w-full sm:w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={COLORS[entry.name] ?? FALLBACK_COLOR} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => money(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="w-full space-y-2 sm:w-1/2">
              {categoryLines.map((l) => {
                const val = l.actual ?? l.planned;
                const share = spent > 0 ? Math.round((val / spent) * 100) : 0;
                return (
                  <li key={l.category} className="flex items-center gap-2 text-sm">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ background: COLORS[l.category] ?? FALLBACK_COLOR }}
                    />
                    <span className="text-text-secondary">{l.category}</span>
                    <span className="ml-auto font-medium text-text-primary">{money(val)}</span>
                    <span className="w-10 text-right text-caption text-text-muted">{share}%</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </Card>

        {/* Live data has real per-city totals; mock data only has planned vs actual. */}
        <Card>
          <h3 className="mb-4 text-h4 text-text-primary">
            {live ? "Spending by City" : "Planned vs Actual"}
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              {live ? (
                <BarChart data={cityData} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="city" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={axisMoney} />
                  <Tooltip formatter={(v) => money(Number(v))} cursor={{ fill: "#f1f5f9" }} />
                  <Bar dataKey="amount" fill="#0d9488" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : (
                <BarChart data={barData} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="category" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={axisMoney} />
                  <Tooltip formatter={(v) => money(Number(v))} cursor={{ fill: "#f1f5f9" }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Planned" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Actual" fill="#0d9488" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
          {live && (budget.unassignedTotal ?? 0) > 0 && (
            <p className="mt-3 text-caption text-text-muted">
              {money(budget.unassignedTotal ?? 0)} not tied to a city (flights, visas…)
            </p>
          )}
        </Card>
      </div>

      {/* Daily cost */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-h4 text-text-primary">Daily Cost</h3>
          {live ? (
            <Badge variant={overBudgetDays ? "warning" : "success"}>
              {overBudgetDays
                ? `${overBudgetDays} day${overBudgetDays > 1 ? "s" : ""} above average`
                : "Evenly spread"}
            </Badge>
          ) : (
            <Badge variant={overBudget ? "error" : "success"}>
              {overBudget ? `${money(-remaining)} over budget` : `${money(remaining)} remaining`}
            </Badge>
          )}
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyData} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={axisMoney} />
              <Tooltip formatter={(v) => money(Number(v))} cursor={{ fill: "#f1f5f9" }} />
              <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                {dailyData.map((d, i) => (
                  <Cell key={i} fill={d.over ? "#f59e0b" : "#0d9488"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {live && (budget.undatedTotal ?? 0) > 0 && (
          <p className="mt-3 text-caption text-text-muted">
            Plus {money(budget.undatedTotal ?? 0)} with no set date, not shown above.
          </p>
        )}
      </Card>
    </div>
  );
}
