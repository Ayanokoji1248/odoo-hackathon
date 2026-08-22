import { DashboardLanding } from "@/components/dashboard/DashboardLanding";
import { mockUser } from "@/data/mock/users";
import { mockTrips } from "@/data/mock/trips";
import { mockCities } from "@/data/mock/cities";

export default function DashboardPage() {
  return <DashboardLanding name={mockUser.name} cities={mockCities} trips={mockTrips} />;
}
