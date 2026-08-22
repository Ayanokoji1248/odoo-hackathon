import { mockCities, getCityById } from "@/data/mock/cities";
import type { City } from "@/types";
import { delay } from "./client";

export async function getCities(): Promise<City[]> {
  return delay(mockCities);
}

export async function getCity(id: string): Promise<City | undefined> {
  return delay(getCityById(id));
}
