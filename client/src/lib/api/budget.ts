import type { Budget, BudgetCategory, BudgetLine } from "@/types";
import { apiFetch } from "./client";

/** Wire shape of `GET /api/v1/trips/{id}/budget`. */
interface ApiBudget {
  currency: string;
  travelers: number;
  days: number;
  activities_total: string;
  manual_total: string;
  grand_total: string;
  avg_per_day: string;
  over_budget_threshold: string;
  by_category: Array<{ category: string; amount: string }>;
  by_activity_category: Array<{ category: string; amount: string }>;
  by_day: Array<{ day: string; amount: string; over_budget: boolean }>;
  by_city: Array<{ city_id: string; city_name: string; amount: string }>;
  undated_total: string;
  unassigned_total: string;
}

/** The API's five budget buckets; the UI has always used its own labels. */
const CATEGORY_LABELS: Record<string, BudgetCategory> = {
  TRANSPORT: "Transport",
  ACCOMMODATION: "Accommodation",
  ACTIVITIES: "Activities",
  MEALS: "Food",
  MISC: "Other",
};

function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export async function getBudget(tripId: string): Promise<Budget> {
  const b = await apiFetch<ApiBudget>(`/api/v1/trips/${tripId}/budget`);

  const lines: BudgetLine[] = b.by_category.map((row) => ({
    category: CATEGORY_LABELS[row.category] ?? "Other",
    // There is no planned-vs-actual split in the data: these are estimates, and
    // no actual-spend tracking exists. `planned` carries the estimate.
    planned: Number(row.amount),
  }));

  return {
    tripId,
    total: Number(b.grand_total),
    currency: b.currency,
    lines,
    daily: b.by_day.map((row) => ({
      date: row.day,
      amount: Number(row.amount),
      overBudget: row.over_budget,
    })),

    // Everything below is live-API only; mock budgets leave it undefined.
    travelers: b.travelers,
    days: b.days,
    activitiesTotal: Number(b.activities_total),
    manualTotal: Number(b.manual_total),
    avgPerDay: Number(b.avg_per_day),
    activityLines: b.by_activity_category.map((row) => ({
      category: titleCase(row.category) as BudgetCategory,
      planned: Number(row.amount),
    })),
    byCity: b.by_city.map((row) => ({
      cityId: row.city_id,
      cityName: row.city_name,
      amount: Number(row.amount),
    })),
    undatedTotal: Number(b.undated_total),
    unassignedTotal: Number(b.unassigned_total),
  };
}

// --- manual cost lines --------------------------------------------------------

export interface ApiBudgetItem {
  id: string;
  trip_id: string;
  trip_stop_id: string | null;
  category: string;
  label: string;
  amount: string;
  incurred_on: string | null;
}

export async function getBudgetItems(tripId: string): Promise<ApiBudgetItem[]> {
  return apiFetch<ApiBudgetItem[]>(`/api/v1/trips/${tripId}/budget-items`);
}

export async function addBudgetItem(
  tripId: string,
  input: {
    category: keyof typeof CATEGORY_LABELS;
    label: string;
    amount: number;
    incurredOn?: string;
    tripStopId?: string;
  }
): Promise<ApiBudgetItem> {
  return apiFetch<ApiBudgetItem>(`/api/v1/trips/${tripId}/budget-items`, {
    method: "POST",
    body: JSON.stringify({
      category: input.category,
      label: input.label,
      amount: input.amount.toFixed(2),
      ...(input.incurredOn ? { incurred_on: input.incurredOn } : {}),
      ...(input.tripStopId ? { trip_stop_id: input.tripStopId } : {}),
    }),
  });
}

export async function deleteBudgetItem(tripId: string, itemId: string): Promise<void> {
  await apiFetch<{ deleted: boolean }>(
    `/api/v1/trips/${tripId}/budget-items/${itemId}`,
    { method: "DELETE" }
  );
}
