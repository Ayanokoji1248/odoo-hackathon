export type TripStatus = "upcoming" | "ongoing" | "completed" | "draft";

export interface TripStop {
  id: string;
  cityId: string;
  cityName: string;
  country: string;
  imageUrl: string;
  startDate: string; // ISO
  endDate: string; // ISO
}

export interface Trip {
  id: string;
  name: string;
  description?: string;
  coverImage: string;
  startDate: string; // ISO
  endDate: string; // ISO
  status: TripStatus;
  stops: TripStop[];
  estimatedBudget: number; // in INR
  ownerId: string;
  activityCount: number;
  isPublic: boolean;
  shareToken?: string;
  createdAt: string;
}
