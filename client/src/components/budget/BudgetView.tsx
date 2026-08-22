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
import { Wallet, CalendarDays, TrendingDown, TrendingUp } from "lucide-react";
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
};

export function BudgetView({ trip, budget }: { trip: Trip; budget: Budget }) {
  const spent = budget.lines.reduce((s, l) => s + (l.actual ?? l.planned), 0);
  const remaining = budget.total - spent;
  const days = daysBetween(trip.startDate, trip.endDate);
  const perDay = Math.round(spent / days);
  const overBudget = remaining < 0;

  const pieData = budget.lines.map((l) => ({
    name: l.category,
    value: l.actual ?? l.planned,
  }));

  const barData = budget.lines.map((l) => ({
    category: l.category,
    Planned: l.planned,
    Actual: l.actual ?? 0,
  }));

  const dailyData = budget.daily.map((d) => ({
    date: formatDate(d.date, { month: "short", day: "numeric" }),
    amount: d.amount,
  }));

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Estimated Total" value={formatCurrency(spent)} icon={Wallet} tone="primary" />
        <StatCard label="Average / Day" value={formatCurrency(perDay)} icon={CalendarDays} tone="info" />
        <StatCard label="Budget Cap" value={formatCurrency(budget.total)} icon={Wallet} tone="secondary" />
        <Card className="flex items-center gap-4">
          <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${overBudget ? "bg-red-50 text-error" : "bg-green-50 text-success"}`}>
            {overBudget ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
          </span>
          <div>
            <p className="text-sm text-text-secondary">{overBudget ? "Over budget" : "Under budget"}</p>
            <p className="text-h3 text-text-primary">{formatCurrency(Math.abs(remaining))}</p>
          </div>
        </Card>
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
                      <Cell key={entry.name} fill={COLORS[entry.name]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="w-full space-y-2 sm:w-1/2">
              {budget.lines.map((l) => {
                const val = l.actual ?? l.planned;
                return (
                  <li key={l.category} className="flex items-center gap-2 text-sm">
                    <span className="h-3 w-3 rounded-full" style={{ background: COLORS[l.category] }} />
                    <span className="text-text-secondary">{l.category}</span>
                    <span className="ml-auto font-medium text-text-primary">{formatCurrency(val)}</span>
                    <span className="w-10 text-right text-caption text-text-muted">
                      {Math.round((val / spent) * 100)}%
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </Card>

        {/* Planned vs actual bar */}
        <Card>
          <h3 className="mb-4 text-h4 text-text-primary">Planned vs Actual</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="category" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} cursor={{ fill: "#f1f5f9" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Planned" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Actual" fill="#0d9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Daily cost */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-h4 text-text-primary">Daily Cost</h3>
          <Badge variant={overBudget ? "error" : "success"}>
            {overBudget ? `${formatCurrency(-remaining)} over budget` : `${formatCurrency(remaining)} remaining`}
          </Badge>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyData} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} cursor={{ fill: "#f1f5f9" }} />
              <Bar dataKey="amount" fill="#0d9488" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
