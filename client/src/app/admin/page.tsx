import { Users, MapPinned, Activity, Wallet } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { adminStats } from "@/data/mock/admin";
import { formatCurrency } from "@/lib/utils/format";

export default function AdminPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-h1 text-text-primary">Admin Panel</h1>
        <p className="mt-1 text-text-secondary">Platform overview, user management and analytics.</p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Users" value={adminStats.users.toLocaleString()} icon={Users} tone="primary" hint="+8.2% this month" />
        <StatCard label="Total Trips" value={adminStats.trips.toLocaleString()} icon={MapPinned} tone="info" hint="+11% this month" />
        <StatCard label="Active Users" value={adminStats.activeUsers.toLocaleString()} icon={Activity} tone="success" hint="Last 30 days" />
        <StatCard label="Avg Trip Budget" value={formatCurrency(adminStats.avgBudget)} icon={Wallet} tone="secondary" />
      </div>

      <AdminTabs />
    </div>
  );
}
