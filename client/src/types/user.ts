export type UserRole = "user" | "admin";

export interface User {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  location?: string;
  bio?: string;
  role: UserRole;
  memberSince: string; // ISO date
  preferences: UserPreferences;
  savedCityIds: string[];
}

export interface UserPreferences {
  currency: "INR" | "USD" | "EUR";
  homeCity?: string;
  travelStyle: TravelStyle[];
  language: string;
  emailNotifications: boolean;
  publicProfile: boolean;
}

export type TravelStyle =
  | "Adventure"
  | "Relaxation"
  | "Culture"
  | "Food"
  | "Nature"
  | "Budget"
  | "Luxury"
  | "Family";
