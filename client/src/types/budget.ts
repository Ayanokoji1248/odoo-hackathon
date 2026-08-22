export type BudgetCategory =
  | "Transport"
  | "Accommodation"
  | "Activities"
  | "Food"
  | "Other";

export interface BudgetLine {
  category: BudgetCategory;
  planned: number; // in INR
  actual?: number;
}

export interface DailyCost {
  date: string; // ISO
  amount: number;
}

export interface Budget {
  tripId: string;
  total: number; // planned total budget cap
  currency: "INR";
  lines: BudgetLine[];
  daily: DailyCost[];
}
