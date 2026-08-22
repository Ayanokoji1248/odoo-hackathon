export type CostIndex = "$" | "$$" | "$$$" | "$$$$";

export interface City {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  region: Region;
  imageUrl: string;
  description: string;
  costIndex: CostIndex;
  popularity: number; // 0-100
  avgDailyCost: number; // in INR
  tags: string[];
  bestSeason: string;
  timezone: string;
}

export type Region =
  | "Europe"
  | "Asia"
  | "North America"
  | "South America"
  | "Africa"
  | "Oceania"
  | "Middle East";
