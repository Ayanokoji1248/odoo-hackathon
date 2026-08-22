import type { Budget, BudgetCategory, BudgetLine } from "@/types";
import { apiFetch } from "./client";

/** Wire shape of `GET /api/v1/trips/{id}/budget`. */
export interface ApiBudget {
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

/**
 * The API's five budget buckets, paired with the labels the UI has always used.
 * One list, because both the read mapping and the write form need it and two
 * copies would drift.
 */
export const BUDGET_CATEGORIES = [
  { value: "TRANSPORT", label: "Transport" },
  { value: "ACCOMMODATION", label: "Accommodation" },
  { value: "MEALS", label: "Food" },
  { value: "ACTIVITIES", label: "Activities" },
  { value: "MISC", label: "Other" },
] as const;

export type BudgetItemCategory = (typeof BUDGET_CATEGORIES)[number]["value"];

const CATEGORY_LABELS = Object.fromEntries(
  BUDGET_CATEGORIES.map((c) => [c.value, c.label])
) as Record<string, BudgetCategory>;

/** e.g. "MEALS" -> "Food". Unknown values fall back rather than render raw enum. */
export function budgetCategoryLabel(value: string): BudgetCategory {
  return CATEGORY_LABELS[value] ?? "Other";
}

function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export async function getBudget(tripId: string): Promise<Budget> {
  return toBudget(tripId, await apiFetch<ApiBudget>(`/api/v1/trips/${tripId}/budget`));
}

/** Exported because the public share view reads the same summary from
 *  `/public/trips/{slug}/budget` and must map it identically. */
export function toBudget(tripId: string, b: ApiBudget): Budget {
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

export interface BudgetItemInput {
  category: BudgetItemCategory;
  label: string;
  amount: number;
  /** Omitted counts in the total but cannot sit on the per-day chart. */
  incurredOn?: string;
  /** Omitted counts in the total but cannot be attributed to a city. */
  tripStopId?: string;
}

/** `null` clears a column; `undefined` leaves it alone. Both are meaningful here,
 *  because "no date" and "unchanged" are different requests. */
function itemBody(input: Partial<BudgetItemInput>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (input.category !== undefined) body.category = input.category;
  if (input.label !== undefined) body.label = input.label;
  if (input.amount !== undefined) body.amount = input.amount.toFixed(2);
  if (input.incurredOn !== undefined) body.incurred_on = input.incurredOn || null;
  if (input.tripStopId !== undefined) body.trip_stop_id = input.tripStopId || null;
  return body;
}

export async function addBudgetItem(
  tripId: string,
  input: BudgetItemInput
): Promise<ApiBudgetItem> {
  return apiFetch<ApiBudgetItem>(`/api/v1/trips/${tripId}/budget-items`, {
    method: "POST",
    body: JSON.stringify(itemBody(input)),
  });
}

/** Amounts get corrected far more often than they get re-entered - a flight
 *  estimate becomes a real price - so this one is worth wiring. */
export async function updateBudgetItem(
  tripId: string,
  itemId: string,
  input: Partial<BudgetItemInput>
): Promise<ApiBudgetItem> {
  return apiFetch<ApiBudgetItem>(`/api/v1/trips/${tripId}/budget-items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify(itemBody(input)),
  });
}

export async function deleteBudgetItem(tripId: string, itemId: string): Promise<void> {
  await apiFetch<{ deleted: boolean }>(
    `/api/v1/trips/${tripId}/budget-items/${itemId}`,
    { method: "DELETE" }
  );
}
