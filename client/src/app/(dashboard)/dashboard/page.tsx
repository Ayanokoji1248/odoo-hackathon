import { DashboardLanding } from "@/components/dashboard/DashboardLanding";
import { mockUser } from "@/data/mock/users";
import { mockTrips } from "@/data/mock/trips";
import { mockCities } from "@/data/mock/cities";

export default function DashboardPage() {
  const previousTrips = mockTrips.filter((t) => t.status === "completed");
  return (
    <DashboardLanding
      name={mockUser.name}
      cities={mockCities}
      previousTrips={previousTrips.length ? previousTrips : mockTrips.slice(0, 3)}
    />
  );
}
