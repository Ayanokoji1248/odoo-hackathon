import { notFound } from "next/navigation";
import { TripHeader } from "@/components/trips/TripHeader";
import { BudgetView } from "@/components/budget/BudgetView";
import { getTripById } from "@/data/mock/trips";
import { getBudgetByTrip } from "@/data/mock/budget";

export default async function BudgetPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const trip = getTripById(tripId);
  if (!trip) notFound();
  const budget = getBudgetByTrip(tripId);

  return (
    <div>
      <TripHeader trip={trip} />
      <div className="mt-6">
        <BudgetView trip={trip} budget={budget} />
      </div>
    </div>
  );
}
