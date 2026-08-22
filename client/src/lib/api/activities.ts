import {
  mockActivities,
  getActivitiesByCity,
  getActivityById,
} from "@/data/mock/activities";
import type { Activity } from "@/types";
import { delay } from "./client";

export async function getActivities(): Promise<Activity[]> {
  return delay(mockActivities);
}

export async function getActivitiesForCity(cityId: string): Promise<Activity[]> {
  return delay(getActivitiesByCity(cityId));
}

export async function getActivity(id: string): Promise<Activity | undefined> {
  return delay(getActivityById(id));
}
