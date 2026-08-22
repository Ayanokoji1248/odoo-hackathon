import { PageHeader } from "@/components/layout/PageHeader";
import { TripCalendar } from "@/components/calendar/TripCalendar";
import { mockTrips } from "@/data/mock/trips";

export default function CalendarPage() {
  return (
    <div>
      <PageHeader title="Calendar View" subtitle="All your trips laid out across the year." />
      <TripCalendar trips={mockTrips} />
    </div>
  );
}
