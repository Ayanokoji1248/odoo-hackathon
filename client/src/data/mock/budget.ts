import type { Budget } from "@/types";

export const mockBudgets: Record<string, Budget> = {
  "trip-1": {
    tripId: "trip-1",
    total: 140000,
    currency: "INR",
    lines: [
      { category: "Transport", planned: 32000, actual: 30500 },
      { category: "Accommodation", planned: 48000, actual: 49200 },
      { category: "Activities", planned: 26000, actual: 24800 },
      { category: "Food", planned: 22000, actual: 18900 },
      { category: "Other", planned: 12000, actual: 8000 },
    ],
    daily: [
      { date: "2026-08-20", amount: 14100 },
      { date: "2026-08-21", amount: 9700 },
      { date: "2026-08-22", amount: 11800 },
      { date: "2026-08-23", amount: 15300 },
      { date: "2026-08-24", amount: 13300 },
      { date: "2026-08-25", amount: 8400 },
      { date: "2026-08-26", amount: 9700 },
      { date: "2026-08-27", amount: 11000 },
      { date: "2026-08-28", amount: 10000 },
      { date: "2026-08-29", amount: 8500 },
    ],
  },
};

export function getBudgetByTrip(tripId: string): Budget {
  return (
    mockBudgets[tripId] ?? {
      tripId,
      total: 0,
      currency: "INR",
      lines: [
        { category: "Transport", planned: 0 },
        { category: "Accommodation", planned: 0 },
        { category: "Activities", planned: 0 },
        { category: "Food", planned: 0 },
        { category: "Other", planned: 0 },
      ],
      daily: [],
    }
  );
}
