import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { TripsExplorer } from "@/components/trips/TripsExplorer";
import { mockTrips } from "@/data/mock/trips";

export default function TripsPage() {
  return (
    <div>
      <PageHeader
        title="My Trips"
        subtitle="All your adventures, past and planned."
        actions={
          <Link href="/trips/create">
            <Button>
              <Plus className="h-4 w-4" /> New Trip
            </Button>
          </Link>
        }
      />
      <TripsExplorer trips={mockTrips} />
    </div>
  );
}
