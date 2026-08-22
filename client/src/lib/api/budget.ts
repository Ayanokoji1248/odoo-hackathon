import { getBudgetByTrip } from "@/data/mock/budget";
import type { Budget } from "@/types";
import { delay } from "./client";

export async function getBudget(tripId: string): Promise<Budget> {
  return delay(getBudgetByTrip(tripId));
}
