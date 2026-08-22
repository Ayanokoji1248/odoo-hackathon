import { mockTrips, getTripById } from "@/data/mock/trips";
import type { Trip } from "@/types";
import { delay } from "./client";

export async function getTrips(): Promise<Trip[]> {
  return delay(mockTrips);
}

export async function getTrip(id: string): Promise<Trip | undefined> {
  return delay(getTripById(id));
}
