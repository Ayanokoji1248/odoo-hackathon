export type BudgetCategory =
  | "Transport"
  | "Accommodation"
  | "Activities"
  | "Food"
  | "Other";

export interface BudgetLine {
  category: BudgetCategory;
  /** The estimate. There is no actual-spend tracking in the data. */
  planned: number;
  actual?: number;
}

export interface DailyCost {
  date: string; // ISO
  amount: number;
  /** Live API only: the day exceeds the trip's average by the threshold. */
  overBudget?: boolean;
}

export interface CityCost {
  cityId: string;
  cityName: string;
  amount: number;
}

export interface Budget {
  tripId: string;
  /** Total estimated cost. Not a cap - no target-budget field exists. */
  total: number;
  currency: string;
  lines: BudgetLine[];
  daily: DailyCost[];

  /** Everything below comes from the live API only; mock budgets omit it. */
  travelers?: number;
  days?: number;
  activitiesTotal?: number;
  manualTotal?: number;
  avgPerDay?: number;
  /** The finer split: Culture, Food, Nightlife … */
  activityLines?: BudgetLine[];
  byCity?: CityCost[];
  /** Money with no date / no city - reported rather than spread around. */
  undatedTotal?: number;
  unassignedTotal?: number;
}
