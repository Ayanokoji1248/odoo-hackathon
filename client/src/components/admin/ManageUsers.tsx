"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, CheckCircle2, ChevronLeft, ChevronRight, Shield, ShieldOff } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { errorMessages } from "@/lib/api/client";
import { getUsers, updateUser, type ManagedUser, type UserQuery } from "@/lib/api/admin";
import { useUser } from "@/lib/auth/AuthProvider";
import { formatDate, pluralize } from "@/lib/utils/format";

const LIMIT = 10;

/**
 * Search, filter and paginate happen **server-side**. Filtering a page of ten in
 * the browser would quietly hide every match on page two, which is exactly the
 * bug a user-management screen must not have.
 */
export function ManageUsers({ onChanged }: { onChanged?: () => void }) {
  const me = useUser();
  const { toast } = useToast();
  const [rows, setRows] = useState<ManagedUser[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<NonNullable<UserQuery["sort"]>>("created_at");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(
    () =>
      getUsers({
        page,
        limit: LIMIT,
        search: search.trim() || undefined,
        isActive: status === "all" ? undefined : status === "active",
        sort,
      })
        .then(({ users, meta }) => {
          setRows(users);
          setTotal(meta?.total ?? users.length);
        })
        .catch(() => {
          setRows([]);
          setTotal(0);
        }),
    [page, search, status, sort]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Every filter resets the page in its own handler rather than in an effect
  // watching them: a stale page number would show an empty table, and an effect
  // that only calls setState is a cascading render for no reason.
  const changeSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };
  const changeStatus = (value: string) => {
    setStatus(value);
    setPage(1);
  };
  const changeSort = (value: NonNullable<UserQuery["sort"]>) => {
    setSort(value);
    setPage(1);
  };

  const act = async (user: ManagedUser, patch: { role?: "user" | "admin"; isActive?: boolean }) => {
    if (busy) return;
    setBusy(user.id);
    try {
      await updateUser(user.id, patch);
      toast(
        patch.isActive === false
          ? `${user.name} deactivated`
          : patch.isActive === true
            ? `${user.name} reactivated`
            : `${user.name} is now ${patch.role}`,
        "success"
      );
      await load();
      onChanged?.();
    } catch (error) {
      toast(errorMessages(error)[0], "error");
    } finally {
      setBusy(null);
    }
  };

  const lastPage = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <h3 className="mb-1 text-h4 text-text-primary">Manage users</h3>
      <p className="mb-4 text-sm text-text-secondary">
        {total > 0 ? pluralize(total, "account") : "No accounts"} · role and access only.
        Accounts are never deleted from here — deactivating one blocks every request
        it makes immediately.
      </p>

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <Input
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => changeSearch(e.target.value)}
        />
        <Select
          value={status}
          onChange={(e) => changeStatus(e.target.value)}
          options={[
            { label: "All", value: "all" },
            { label: "Active", value: "active" },
            { label: "Deactivated", value: "inactive" },
          ]}
        />
        <Select
          value={sort}
          onChange={(e) => changeSort(e.target.value as NonNullable<UserQuery["sort"]>)}
          options={[
            { label: "Newest", value: "created_at" },
            { label: "Most trips", value: "trips" },
            { label: "Name", value: "name" },
          ]}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-160 text-sm">
          <thead>
            <tr className="border-b border-border text-left text-caption uppercase tracking-wider text-text-muted">
              <th className="pb-2 font-semibold">User</th>
              <th className="pb-2 font-semibold">Trips</th>
              <th className="pb-2 font-semibold">Role</th>
              <th className="pb-2 font-semibold">Status</th>
              <th className="pb-2 font-semibold">Joined</th>
              <th className="pb-2 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows === null ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={6} className="py-3">
                    <div className="h-9 animate-pulse rounded-lg bg-black/5" />
                  </td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-text-muted">
                  No accounts match those filters.
                </td>
              </tr>
            ) : (
              rows.map((u) => {
                const self = u.id === me.id;
                return (
                  <tr key={u.id} className="hover:bg-surface-muted/60">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} src={u.avatarUrl} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-text-primary">
                            {u.name}
                            {self && (
                              <span className="ml-2 text-caption font-normal text-text-muted">
                                you
                              </span>
                            )}
                          </p>
                          <p className="truncate text-caption text-text-muted">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-text-secondary">{u.tripCount}</td>
                    <td className="py-3">
                      <Badge variant={u.role === "admin" ? "primary" : "outline"}>{u.role}</Badge>
                    </td>
                    <td className="py-3">
                      <Badge variant={u.isActive ? "success" : "default"}>
                        {u.isActive ? "active" : "deactivated"}
                      </Badge>
                    </td>
                    <td className="py-3 text-text-secondary">
                      {formatDate(u.createdAt, { month: "short", year: "numeric" })}
                    </td>
                    <td className="py-3">
                      <div className="flex justify-end gap-1">
                        {/* Both actions are disabled on your own row: the API
                            refuses them anyway, and a button that always errors
                            is worse than no button. */}
                        <button
                          onClick={() =>
                            act(u, { role: u.role === "admin" ? "user" : "admin" })
                          }
                          disabled={self || busy === u.id}
                          title={
                            self
                              ? "You cannot change your own role"
                              : u.role === "admin"
                                ? "Demote to user"
                                : "Promote to admin"
                          }
                          aria-label={u.role === "admin" ? "Demote" : "Promote"}
                          className="rounded-lg p-1.5 text-text-muted hover:bg-surface-muted hover:text-text-primary disabled:opacity-30"
                        >
                          {u.role === "admin" ? (
                            <ShieldOff className="h-4 w-4" />
                          ) : (
                            <Shield className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => act(u, { isActive: !u.isActive })}
                          disabled={self || busy === u.id}
                          title={
                            self
                              ? "You cannot deactivate your own account"
                              : u.isActive
                                ? "Deactivate"
                                : "Reactivate"
                          }
                          aria-label={u.isActive ? "Deactivate" : "Reactivate"}
                          className={
                            u.isActive
                              ? "rounded-lg p-1.5 text-text-muted hover:bg-amber-50 hover:text-amber-700 disabled:opacity-30"
                              : "rounded-lg p-1.5 text-text-muted hover:bg-green-50 hover:text-success disabled:opacity-30"
                          }
                        >
                          {u.isActive ? (
                            <Ban className="h-4 w-4" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {lastPage > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-caption text-text-muted">
            Page {page} of {lastPage}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= lastPage}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
