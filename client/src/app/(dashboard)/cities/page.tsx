import { PageHeader } from "@/components/layout/PageHeader";
import { ExploreTabs } from "@/components/layout/ExploreTabs";
import { CitiesExplorer } from "@/components/cities/CitiesExplorer";
import { getCities } from "@/lib/api/cities";

export default async function CitiesPage() {
  // A backend that is down should render an empty explorer, not a stack trace.
  const cities = await getCities().catch(() => []);

  return (
    <div>
      <PageHeader title="Explore Cities" subtitle="Find your next destination." />
      <ExploreTabs />
      <CitiesExplorer cities={cities} />
    </div>
  );
}
