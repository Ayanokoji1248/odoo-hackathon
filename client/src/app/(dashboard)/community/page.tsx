import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { CommunityFeed } from "@/components/community/CommunityFeed";
import { mockCommunity } from "@/data/mock/community";
import { Plus } from "lucide-react";

export default function CommunityPage() {
  return (
    <div>
      <PageHeader
        title="Community"
        subtitle="Share your experiences and discover trips and activities from fellow travellers. Search, group and filter to find exactly what you're looking for."
        actions={
          <Button>
            <Plus className="h-4 w-4" /> Share experience
          </Button>
        }
      />
      <CommunityFeed posts={mockCommunity} />
    </div>
  );
}
