import { PageHeader } from "@/components/layout/PageHeader";
import { ExploreTabs } from "@/components/layout/ExploreTabs";
import { ActivitiesExplorer } from "@/components/activities/ActivitiesExplorer";
import { mockActivities } from "@/data/mock/activities";

export default function ActivitiesPage() {
  return (
    <div>
      <PageHeader title="Explore Activities" subtitle="Discover unforgettable things to do." />
      <ExploreTabs />
      <ActivitiesExplorer activities={mockActivities} />
    </div>
  );
}
