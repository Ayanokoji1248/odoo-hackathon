import { PageHeader } from "@/components/layout/PageHeader";
import { ExploreTabs } from "@/components/layout/ExploreTabs";
import { ActivitiesExplorer } from "@/components/activities/ActivitiesExplorer";
import { getActivities } from "@/lib/api/activities";

export default async function ActivitiesPage() {
  const activities = await getActivities().catch(() => []);

  return (
    <div>
      <PageHeader title="Explore Activities" subtitle="Discover unforgettable things to do." />
      <ExploreTabs />
      <ActivitiesExplorer activities={activities} />
    </div>
  );
}
