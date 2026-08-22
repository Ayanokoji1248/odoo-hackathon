export type ActivityCategory =
  | "Sightseeing"
  | "Food"
  | "Adventure"
  | "Culture"
  | "Shopping"
  | "Nightlife"
  | "Nature";

export interface Activity {
  id: string;
  name: string;
  cityId: string;
  cityName: string;
  category: ActivityCategory;
  imageUrl: string;
  description: string;
  durationHours: number;
  cost: number; // in INR
  rating: number; // 0-5
  reviews: number;
  tags: string[];
}
