import { Bookmark } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { CityCard } from "@/components/cities/CityCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { mockUser } from "@/data/mock/users";
import { mockCities } from "@/data/mock/cities";

export default function SavedPage() {
  const saved = mockCities.filter((c) => mockUser.savedCityIds.includes(c.id));

  return (
    <div>
      <PageHeader title="Saved" subtitle="Destinations you've bookmarked for later." />
      {saved.length === 0 ? (
        <EmptyState icon={Bookmark} title="Nothing saved yet" description="Tap the bookmark on any city to save it here." />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {saved.map((city) => (
            <CityCard key={city.id} city={city} />
          ))}
        </div>
      )}
    </div>
  );
}
