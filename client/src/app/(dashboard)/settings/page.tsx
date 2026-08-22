import { PageHeader } from "@/components/layout/PageHeader";
import { SettingsPanel } from "@/components/profile/SettingsPanel";

export default function SettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your profile, preferences, and privacy." />
      <SettingsPanel />
    </div>
  );
}
