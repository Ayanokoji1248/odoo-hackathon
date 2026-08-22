import type { User } from "@/types";

// Still referenced by the trip/share/admin fixtures, which have no API behind
// them yet. The signed-in user's own identity no longer comes from here — see
// `AuthProvider` / `useUser()`.
export const mockUser: User = {
  id: "user-1",
  name: "Smrutiranjan Barik",
  firstName: "Smrutiranjan",
  lastName: "Barik",
  email: "smruti@globetrotter.app",
  avatarUrl:
    "https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=crop&w=200&q=80",
  location: "Bengaluru, India",
  bio: "Weekend wanderer chasing sunsets, street food, and one-way tickets. 24 countries and counting.",
  role: "user",
  memberSince: "2024-03-12",
  preferences: {
    currency: "INR",
    homeCity: "Bengaluru",
    travelStyle: ["Adventure", "Food", "Culture"],
    language: "English",
    emailNotifications: true,
    publicProfile: true,
  },
  savedCityIds: ["city-tokyo", "city-bali", "city-lisbon"],
};

export const mockAdmin: User = {
  ...mockUser,
  id: "admin-1",
  name: "Admin User",
  firstName: "Admin",
  lastName: "User",
  email: "admin@globetrotter.app",
  role: "admin",
};
