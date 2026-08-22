export const adminStats = {
  users: 12480,
  trips: 34210,
  activeUsers: 4820,
  avgBudget: 96500,
};

export const tripsCreated = [
  { month: "Mar", trips: 1820 },
  { month: "Apr", trips: 2140 },
  { month: "May", trips: 2680 },
  { month: "Jun", trips: 3120 },
  { month: "Jul", trips: 3890 },
  { month: "Aug", trips: 4310 },
];

export const userGrowth = [
  { month: "Mar", users: 6400 },
  { month: "Apr", users: 7800 },
  { month: "May", users: 9100 },
  { month: "Jun", users: 10300 },
  { month: "Jul", users: 11500 },
  { month: "Aug", users: 12480 },
];

export const popularCities = [
  { name: "Paris", trips: 5240 },
  { name: "Tokyo", trips: 4810 },
  { name: "London", trips: 4390 },
  { name: "Rome", trips: 3720 },
  { name: "Bali", trips: 3410 },
];

export const popularActivities = [
  { name: "Eiffel Tower", count: 3120 },
  { name: "Colosseum", count: 2840 },
  { name: "London Eye", count: 2510 },
  { name: "Louvre", count: 2330 },
  { name: "Shibuya Walk", count: 1980 },
];

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  trips: number;
  status: "active" | "inactive";
  joined: string;
}

const av = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=80&q=80`;

export const managedUsers: ManagedUser[] = [
  { id: "u1", name: "Aarav Mehta", email: "aarav@example.com", avatarUrl: av("1500648767791-00dcc994a43e"), trips: 12, status: "active", joined: "2024-05-02" },
  { id: "u2", name: "Sara Fernandes", email: "sara@example.com", avatarUrl: av("1544005313-94ddf0286df2"), trips: 8, status: "active", joined: "2024-07-19" },
  { id: "u3", name: "Diego Alvarez", email: "diego@example.com", avatarUrl: av("1506794778202-cad84cf45f1d"), trips: 5, status: "inactive", joined: "2025-01-11" },
  { id: "u4", name: "Lena Kowalski", email: "lena@example.com", avatarUrl: av("1534528741775-53994a69daeb"), trips: 15, status: "active", joined: "2023-11-28" },
  { id: "u5", name: "Rahul Nair", email: "rahul@example.com", avatarUrl: av("1633332755192-727a05c4013d"), trips: 3, status: "active", joined: "2025-03-06" },
  { id: "u6", name: "Mia Chen", email: "mia@example.com", avatarUrl: av("1502685104226-ee32379fefbe"), trips: 9, status: "inactive", joined: "2024-09-14" },
];
