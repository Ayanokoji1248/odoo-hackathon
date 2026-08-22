"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Pencil,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Modal } from "@/components/ui/Modal";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { errorMessages } from "@/lib/api/client";
import {
  ACTIVITY_CATEGORIES,
  createActivity,
  createCity,
  getAdminActivities,
  getAdminCities,
  updateActivity,
  updateCity,
  type AdminActivity,
  type AdminActivityCategory,
  type AdminCity,
} from "@/lib/api/admin";
import { cn } from "@/lib/utils/cn";
import { formatCurrency, pluralize } from "@/lib/utils/format";

const LIMIT = 10;

function Problems({ messages }: { messages: string[] }) {
  if (messages.length === 0) return null;
  return (
    <div className="flex gap-2.5 rounded-xl border border-error/30 bg-red-50 p-3">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
      <ul className="space-y-0.5 text-sm text-error">
        {messages.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </div>
  );
}

function Pager({
  page,
  total,
  onPage,
}: {
  page: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const last = Math.max(1, Math.ceil(total / LIMIT));
  if (last <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between">
      <p className="text-caption text-text-muted">
        Page {page} of {last}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page === 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="h-4 w-4" /> Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= last}
          onClick={() => onPage(page + 1)}
        >
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * The admin's actual job: the app is unusable on day one if these two tables are
 * empty, and a wrong price here is a wrong budget on every trip planned after it.
 *
 * Nothing is ever deleted. `is_active = false` hides a row from every public read
 * while leaving it intact for the trips that snapshotted it — and
 * `activities.city_id` is ON DELETE RESTRICT, so a real delete would either error
 * or orphan somebody's saved plan.
 */
export function ManageCatalog({ onChanged }: { onChanged?: () => void }) {
  const [tab, setTab] = useState("cities");
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <h3 className="mb-1 text-h4 text-text-primary">Catalogue</h3>
      <p className="mb-4 text-sm text-text-secondary">
        What travellers pick from. Hiding a row removes it from search and from every
        public read, but never from the trips that already saved it.
      </p>
      <Tabs
        tabs={[
          { label: "Cities", value: "cities" },
          { label: "Activities", value: "activities" },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="mt-5">
        {tab === "cities" ? (
          <CitiesTable onChanged={onChanged} />
        ) : (
          <ActivitiesTable onChanged={onChanged} />
        )}
      </div>
    </div>
  );
}

// --- cities -------------------------------------------------------------------

function CitiesTable({ onChanged }: { onChanged?: () => void }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<AdminCity[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AdminCity | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(
    () =>
      getAdminCities({ page, limit: LIMIT, search: search.trim() || undefined })
        .then(({ cities, meta }) => {
          setRows(cities);
          setTotal(meta?.total ?? cities.length);
        })
        .catch(() => {
          setRows([]);
          setTotal(0);
        }),
    [page, search]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Reset in the handler, not an effect watching `search`: an effect that only
  // calls setState is a cascading render, and a stale page shows an empty table.
  const changeSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const toggle = async (city: AdminCity) => {
    if (busy) return;
    setBusy(city.id);
    try {
      await updateCity(city.id, { isActive: !city.isActive });
      toast(`${city.name} ${city.isActive ? "hidden" : "visible"}`, "success");
      await load();
      onChanged?.();
    } catch (error) {
      toast(errorMessages(error)[0], "error");
    } finally {
      setBusy(null);
    }
  };

  const done = async () => {
    await load();
    onChanged?.();
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Input
          className="sm:max-w-xs"
          placeholder="Search city or country…"
          value={search}
          onChange={(e) => changeSearch(e.target.value)}
        />
        <Button size="sm" className="sm:ml-auto" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> New city
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-160 text-sm">
          <thead>
            <tr className="border-b border-border text-left text-caption uppercase tracking-wider text-text-muted">
              <th className="pb-2 font-semibold">City</th>
              <th className="pb-2 font-semibold">Region</th>
              <th className="pb-2 font-semibold">Cost / day</th>
              <th className="pb-2 font-semibold">Activities</th>
              <th className="pb-2 font-semibold">Visible</th>
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
                  No cities match that search.
                </td>
              </tr>
            ) : (
              rows.map((c) => (
                <tr
                  key={c.id}
                  className={cn("hover:bg-surface-muted/60", !c.isActive && "opacity-60")}
                >
                  <td className="py-3">
                    <p className="font-medium text-text-primary">{c.name}</p>
                    <p className="text-caption text-text-muted">{c.country}</p>
                  </td>
                  <td className="py-3 text-text-secondary">{c.region ?? "—"}</td>
                  <td className="py-3 text-text-secondary">
                    {c.avgDailyCost === undefined
                      ? "—"
                      : formatCurrency(c.avgDailyCost, "USD")}
                    <span className="ml-1.5 text-caption text-text-muted">
                      (index {c.costIndex})
                    </span>
                  </td>
                  <td className="py-3 text-text-secondary">{c.activityCount}</td>
                  <td className="py-3">
                    <Badge variant={c.isActive ? "success" : "default"}>
                      {c.isActive ? "live" : "hidden"}
                    </Badge>
                  </td>
                  <td className="py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setEditing(c)}
                        aria-label={`Edit ${c.name}`}
                        className="rounded-lg p-1.5 text-text-muted hover:bg-surface-muted hover:text-text-primary"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => toggle(c)}
                        disabled={busy === c.id}
                        title={c.isActive ? "Hide from travellers" : "Make visible again"}
                        aria-label={c.isActive ? "Hide" : "Show"}
                        className="rounded-lg p-1.5 text-text-muted hover:bg-surface-muted hover:text-text-primary disabled:opacity-30"
                      >
                        {c.isActive ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pager page={page} total={total} onPage={setPage} />

      {adding && <CityDialog onClose={() => setAdding(false)} onSaved={done} />}
      {editing && (
        <CityDialog city={editing} onClose={() => setEditing(null)} onSaved={done} />
      )}
    </div>
  );
}

function CityDialog({
  city,
  onClose,
  onSaved,
}: {
  city?: AdminCity;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(city?.name ?? "");
  const [country, setCountry] = useState(city?.country ?? "");
  const [region, setRegion] = useState(city?.region ?? "");
  const [costIndex, setCostIndex] = useState(String(city?.costIndex ?? 50));
  const [popularity, setPopularity] = useState(String(city?.popularityScore ?? 0));
  const [avgDailyCost, setAvgDailyCost] = useState(
    city?.avgDailyCost === undefined ? "" : String(city.avgDailyCost)
  );
  const [bestSeason, setBestSeason] = useState(city?.bestSeason ?? "");
  const [imageUrl, setImageUrl] = useState(city?.imageUrl ?? "");
  const [tags, setTags] = useState((city?.tags ?? []).join(", "));
  const [description, setDescription] = useState(city?.description ?? "");
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const cost = Number(costIndex);
  const badCost = costIndex === "" || !Number.isInteger(cost) || cost < 1 || cost > 100;
  const pop = Number(popularity);
  const badPop = popularity === "" || !Number.isInteger(pop) || pop < 0 || pop > 100;

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setErrors([]);
    try {
      const payload = {
        name: name.trim(),
        country: country.trim(),
        region,
        costIndex: cost,
        popularityScore: pop,
        avgDailyCost: avgDailyCost === "" ? undefined : Number(avgDailyCost),
        bestSeason,
        imageUrl,
        description,
        // Trimmed and de-blanked: "Food, , Nightlife" must not store an empty tag.
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      };
      if (city) await updateCity(city.id, payload);
      else await createCity(payload);
      toast(city ? `${payload.name} updated` : `${payload.name} added`, "success");
      await onSaved();
      onClose();
    } catch (error) {
      setErrors(errorMessages(error));
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={city ? `Edit ${city.name}` : "New city"}
      description="Cost index drives the $–$$$$ badge travellers see; the daily cost is the number the explore cards show."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={save}
            loading={saving}
            disabled={!name.trim() || !country.trim() || badCost || badPop}
          >
            {city ? "Save city" : "Add city"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Problems messages={errors} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Name"
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="Country"
            value={country}
            maxLength={80}
            onChange={(e) => setCountry(e.target.value)}
            hint="Name + country must be unique."
          />
          <Select
            label="Region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            options={[
              { label: "—", value: "" },
              ...[
                "Europe",
                "Asia",
                "North America",
                "South America",
                "Africa",
                "Oceania",
                "Middle East",
              ].map((r) => ({ label: r, value: r })),
            ]}
          />
          <Input
            label="Best season"
            value={bestSeason}
            maxLength={40}
            placeholder="e.g. Apr–Jun"
            onChange={(e) => setBestSeason(e.target.value)}
          />
          <Input
            label="Cost index (1–100)"
            type="number"
            min={1}
            max={100}
            value={costIndex}
            onChange={(e) => setCostIndex(e.target.value)}
            error={badCost ? "A whole number from 1 to 100" : undefined}
          />
          <Input
            label="Popularity (0–100)"
            type="number"
            min={0}
            max={100}
            value={popularity}
            onChange={(e) => setPopularity(e.target.value)}
            error={badPop ? "A whole number from 0 to 100" : undefined}
            hint="Editorial ranking, not measured usage."
          />
          <Input
            label="Avg daily cost (USD)"
            type="number"
            min={0}
            step="0.01"
            value={avgDailyCost}
            onChange={(e) => setAvgDailyCost(e.target.value)}
            hint="Per person. Leave blank for none."
          />
          <Input
            label="Image URL"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            hint="There is no upload storage yet."
          />
        </div>
        <Input
          label="Tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          hint="Comma separated, e.g. Food, Museums, Nightlife"
        />
        <Textarea
          label="Description"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
    </Modal>
  );
}

// --- activities ---------------------------------------------------------------

function ActivitiesTable({ onChanged }: { onChanged?: () => void }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<AdminActivity[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [cities, setCities] = useState<AdminCity[]>([]);
  const [cityId, setCityId] = useState("");
  const [editing, setEditing] = useState<AdminActivity | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // The city filter and the create form both need the full list, hidden rows
  // included - an activity can legitimately belong to a city that is currently
  // hidden.
  useEffect(() => {
    getAdminCities({ limit: 100 })
      .then(({ cities: rows }) => setCities(rows))
      .catch(() => setCities([]));
  }, []);

  const load = useCallback(
    () =>
      getAdminActivities({
        page,
        limit: LIMIT,
        search: search.trim() || undefined,
        cityId: cityId || undefined,
      })
        .then(({ activities, meta }) => {
          setRows(activities);
          setTotal(meta?.total ?? activities.length);
        })
        .catch(() => {
          setRows([]);
          setTotal(0);
        }),
    [page, search, cityId]
  );

  useEffect(() => {
    load();
  }, [load]);

  const changeSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };
  const changeCity = (value: string) => {
    setCityId(value);
    setPage(1);
  };

  const toggle = async (activity: AdminActivity) => {
    if (busy) return;
    setBusy(activity.id);
    try {
      await updateActivity(activity.id, { isActive: !activity.isActive });
      toast(`${activity.name} ${activity.isActive ? "hidden" : "visible"}`, "success");
      await load();
      onChanged?.();
    } catch (error) {
      toast(errorMessages(error)[0], "error");
    } finally {
      setBusy(null);
    }
  };

  const done = async () => {
    await load();
    onChanged?.();
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Input
          className="sm:max-w-xs"
          placeholder="Search activities…"
          value={search}
          onChange={(e) => changeSearch(e.target.value)}
        />
        <Select
          className="sm:max-w-xs"
          value={cityId}
          onChange={(e) => changeCity(e.target.value)}
          options={[
            { label: "All cities", value: "" },
            ...cities.map((c) => ({ label: `${c.name}, ${c.country}`, value: c.id })),
          ]}
        />
        <Button
          size="sm"
          className="sm:ml-auto"
          onClick={() => setAdding(true)}
          disabled={cities.length === 0}
          title={cities.length === 0 ? "Add a city first" : undefined}
        >
          <Plus className="h-4 w-4" /> New activity
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-160 text-sm">
          <thead>
            <tr className="border-b border-border text-left text-caption uppercase tracking-wider text-text-muted">
              <th className="pb-2 font-semibold">Activity</th>
              <th className="pb-2 font-semibold">City</th>
              <th className="pb-2 font-semibold">Category</th>
              <th className="pb-2 font-semibold">Price</th>
              <th className="pb-2 font-semibold">Visible</th>
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
                  No activities match those filters.
                </td>
              </tr>
            ) : (
              rows.map((a) => (
                <tr
                  key={a.id}
                  className={cn("hover:bg-surface-muted/60", !a.isActive && "opacity-60")}
                >
                  <td className="py-3">
                    <p className="font-medium text-text-primary">{a.name}</p>
                    {a.durationMinutes && (
                      <p className="text-caption text-text-muted">
                        {pluralize(a.durationMinutes, "min")}
                      </p>
                    )}
                  </td>
                  <td className="py-3 text-text-secondary">{a.cityName}</td>
                  <td className="py-3">
                    <Badge variant="outline">{a.category}</Badge>
                  </td>
                  <td className="py-3 text-text-secondary">
                    {formatCurrency(a.estimatedCost, a.currency)}
                  </td>
                  <td className="py-3">
                    <Badge variant={a.isActive ? "success" : "default"}>
                      {a.isActive ? "live" : "hidden"}
                    </Badge>
                  </td>
                  <td className="py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setEditing(a)}
                        aria-label={`Edit ${a.name}`}
                        className="rounded-lg p-1.5 text-text-muted hover:bg-surface-muted hover:text-text-primary"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => toggle(a)}
                        disabled={busy === a.id}
                        title={a.isActive ? "Hide from travellers" : "Make visible again"}
                        aria-label={a.isActive ? "Hide" : "Show"}
                        className="rounded-lg p-1.5 text-text-muted hover:bg-surface-muted hover:text-text-primary disabled:opacity-30"
                      >
                        {a.isActive ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pager page={page} total={total} onPage={setPage} />

      {adding && (
        <ActivityDialog cities={cities} onClose={() => setAdding(false)} onSaved={done} />
      )}
      {editing && (
        <ActivityDialog
          cities={cities}
          activity={editing}
          onClose={() => setEditing(null)}
          onSaved={done}
        />
      )}
    </div>
  );
}

function ActivityDialog({
  cities,
  activity,
  onClose,
  onSaved,
}: {
  cities: AdminCity[];
  activity?: AdminActivity;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const { toast } = useToast();
  const [cityId, setCityId] = useState(activity?.cityId ?? cities[0]?.id ?? "");
  const [name, setName] = useState(activity?.name ?? "");
  const [category, setCategory] = useState<AdminActivityCategory>(
    activity?.category ?? "SIGHTSEEING"
  );
  const [cost, setCost] = useState(activity ? String(activity.estimatedCost) : "");
  const [duration, setDuration] = useState(
    activity?.durationMinutes === undefined ? "" : String(activity.durationMinutes)
  );
  const [imageUrl, setImageUrl] = useState(activity?.imageUrl ?? "");
  const [description, setDescription] = useState(activity?.description ?? "");
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const parsedCost = Number(cost);
  const badCost = cost === "" || !Number.isFinite(parsedCost) || parsedCost < 0;
  // The DB CHECK is duration_minutes > 0, so 0 is not "no duration" - blank is.
  const badDuration = duration !== "" && (!Number.isInteger(Number(duration)) || Number(duration) <= 0);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setErrors([]);
    try {
      const payload = {
        cityId,
        name: name.trim(),
        category,
        estimatedCost: parsedCost,
        durationMinutes: duration === "" ? undefined : Number(duration),
        imageUrl,
        description,
      };
      if (activity) await updateActivity(activity.id, payload);
      else await createActivity(payload);
      toast(activity ? `${payload.name} updated` : `${payload.name} added`, "success");
      await onSaved();
      onClose();
    } catch (error) {
      setErrors(errorMessages(error));
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={activity ? `Edit ${activity.name}` : "New activity"}
      description="Prices are per person and in USD — the whole catalogue is single-currency."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={save}
            loading={saving}
            disabled={!name.trim() || !cityId || badCost || badDuration}
          >
            {activity ? "Save activity" : "Add activity"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Problems messages={errors} />
        <Input
          label="Name"
          value={name}
          maxLength={160}
          onChange={(e) => setName(e.target.value)}
          hint="Must be unique within its city."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="City"
            value={cityId}
            onChange={(e) => setCityId(e.target.value)}
            options={cities.map((c) => ({
              label: `${c.name}, ${c.country}${c.isActive ? "" : " (hidden)"}`,
              value: c.id,
            }))}
          />
          <Select
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value as AdminActivityCategory)}
            options={ACTIVITY_CATEGORIES.map((c) => ({ label: c, value: c }))}
          />
          <Input
            label="Price (USD)"
            type="number"
            min={0}
            step="0.01"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            error={badCost ? "Zero or more" : undefined}
            hint="Per person. 0 for free."
          />
          <Input
            label="Duration (minutes)"
            type="number"
            min={1}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            error={badDuration ? "A whole number above 0, or blank" : undefined}
            hint="Blank if it varies."
          />
        </div>
        <Input
          label="Image URL"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
        />
        <Textarea
          label="Description"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
    </Modal>
  );
}
