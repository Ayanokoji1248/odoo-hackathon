import { PageHeader } from "@/components/layout/PageHeader";
import { ExploreTabs } from "@/components/layout/ExploreTabs";
import { CitiesExplorer } from "@/components/cities/CitiesExplorer";
import { mockCities } from "@/data/mock/cities";

export default function CitiesPage() {
  return (
    <div>
      <PageHeader title="Explore Cities" subtitle="Find your next destination." />
      <ExploreTabs />
      <CitiesExplorer cities={mockCities} />
    </div>
  );
}
