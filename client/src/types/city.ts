export type CostIndex = "$" | "$$" | "$$$" | "$$$$";

export interface City {
  id: string;
  name: string;
  country: string;
  region: Region;
  imageUrl: string;
  description: string;
  /** Derived from the API's 1-100 cost_index. */
  costIndex: CostIndex;
  popularity: number; // 0-100
  /** Per-person daily estimate, in the catalog currency (USD). */
  avgDailyCost: number;
  tags: string[];
  bestSeason: string;
  /** Not served by the catalog API - present only on mock rows. */
  countryCode?: string;
  timezone?: string;
}

export type Region =
  | "Europe"
  | "Asia"
  | "North America"
  | "South America"
  | "Africa"
  | "Oceania"
  | "Middle East";
