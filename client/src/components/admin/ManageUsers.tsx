"use client";

import { useMemo, useState } from "react";
import { Eye, Ban, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { FilterToolbar } from "@/components/layout/FilterToolbar";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/utils/format";
import { managedUsers } from "@/data/mock/admin";

export function ManageUsers() {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("trips");

  const rows = useMemo(() => {
    return managedUsers
      .filter((u) => {
        const q = !query || u.name.toLowerCase().includes(query.toLowerCase()) || u.email.toLowerCase().includes(query.toLowerCase());
        const s = status === "all" || u.status === status;
        return q && s;
      })
      .sort((a, b) => (sort === "trips" ? b.trips - a.trips : a.name.localeCompare(b.name)));
  }, [query, status, sort]);

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <h3 className="mb-1 text-h4 text-text-primary">Manage Users</h3>
      <p className="mb-4 text-sm text-text-secondary">
        View and manage all users and the trips they&apos;ve created.
      </p>

      <FilterToolbar
        className="mb-4"
        query={query}
        onQueryChange={setQuery}
        placeholder="Search users…"
        groupBy={{ value: status, options: [{ label: "All", value: "all" }, { label: "Active", value: "active" }, { label: "Inactive", value: "inactive" }], onChange: setStatus }}
        filterBy={{ value: status, options: [{ label: "All", value: "all" }, { label: "Active", value: "active" }, { label: "Inactive", value: "inactive" }], onChange: setStatus }}
        sortBy={{ value: sort, options: [{ label: "Trips", value: "trips" }, { label: "Name", value: "name" }], onChange: setSort }}
      />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-caption uppercase tracking-wider text-text-muted">
              <th className="pb-2 font-semibold">User</th>
              <th className="pb-2 font-semibold">Trips</th>
              <th className="pb-2 font-semibold">Status</th>
              <th className="pb-2 font-semibold">Joined</th>
              <th className="pb-2 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((u) => (
              <tr key={u.id} className="hover:bg-surface-muted/60">
                <td className="py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={u.name} src={u.avatarUrl} size="sm" />
                    <div>
                      <p className="font-medium text-text-primary">{u.name}</p>
                      <p className="text-caption text-text-muted">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 text-text-secondary">{u.trips}</td>
                <td className="py-3">
                  <Badge variant={u.status === "active" ? "success" : "default"}>{u.status}</Badge>
                </td>
                <td className="py-3 text-text-secondary">{formatDate(u.joined, { month: "short", year: "numeric" })}</td>
                <td className="py-3">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => toast(`Viewing ${u.name}'s trips`, "info")} aria-label="View" className="rounded-lg p-1.5 text-text-muted hover:bg-surface-muted hover:text-text-primary"><Eye className="h-4 w-4" /></button>
                    <button onClick={() => toast(`${u.name} suspended`, "warning")} aria-label="Suspend" className="rounded-lg p-1.5 text-text-muted hover:bg-amber-50 hover:text-amber-700"><Ban className="h-4 w-4" /></button>
                    <button onClick={() => toast(`${u.name} removed`, "info")} aria-label="Delete" className="rounded-lg p-1.5 text-text-muted hover:bg-red-50 hover:text-error"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
