import { CardGridSkeleton } from "@/components/ui/Skeletons";

export default function Loading() {
  return (
    <div>
      <div className="mb-6 h-9 w-40 skeleton rounded-lg" />
      <CardGridSkeleton count={6} kind="trip" />
    </div>
  );
}
