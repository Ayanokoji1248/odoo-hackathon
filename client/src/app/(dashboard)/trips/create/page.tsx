import { PageHeader } from "@/components/layout/PageHeader";
import { CreateTripWizard } from "@/components/trips/CreateTripWizard";

export default function CreateTripPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Create a Trip" subtitle="Five quick steps to your next adventure." />
      <CreateTripWizard />
    </div>
  );
}
