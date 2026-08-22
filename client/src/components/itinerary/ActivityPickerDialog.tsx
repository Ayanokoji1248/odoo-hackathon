"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { AlertTriangle, Check, Clock, Search } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { getActivitiesForCity } from "@/lib/api/activities";
import { errorMessages } from "@/lib/api/client";
import { addTripActivity, type ApiTripStop } from "@/lib/api/trips";
import { cn } from "@/lib/utils/cn";
import { formatCurrency, pluralize } from "@/lib/utils/format";
import type { Activity, ActivityCategory, Trip } from "@/types";

/** Every date the stop covers - the API rejects anything outside it. */
export function stopDays(stop: ApiTripStop): string[] {
  const days: string[] = [];
  for (
    const cursor = new Date(stop.start_date);
    cursor <= new Date(stop.end_date);
    cursor.setDate(cursor.getDate() + 1)
  ) {
    days.push(cursor.toISOString().slice(0, 10));
  }
  return days;
}

/**
 * Add an activity to one stop. The list is fetched with `city_id` = the stop's
 * city, which is also what the API enforces: a catalog activity from another city
 * is a 400. Anything not in the catalogue goes in as a custom activity by name.
 */
export function ActivityPickerDialog({
  trip,
  stop,
  onClose,
  onAdded,
}: {
  trip: Trip;
  stop: ApiTripStop;
  onClose: () => void;
  onAdded: () => Promise<void> | void;
}) {
  const { toast } = useToast();
  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [picked, setPicked] = useState<string[]>([]);
  const [customName, setCustomName] = useState("");
  const days = stopDays(stop);
  const [day, setDay] = useState(days[0]);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getActivitiesForCity(stop.city_id)
      .then(setActivities)
      .catch(() => setActivities([]));
  }, [stop.city_id]);

  const categories = useMemo(() => {
    const seen = new Set<ActivityCategory>(activities?.map((a) => a.category) ?? []);
    return ["all", ...Array.from(seen).sort()];
  }, [activities]);

  // Already on this stop, on any day - adding a second copy is almost never meant.
  const alreadyAdded = useMemo(
    () => new Set(stop.activities.map((a) => a.activity_id).filter(Boolean)),
    [stop.activities]
  );

  const filtered = useMemo(() => {
    if (!activities) return [];
    const q = query.trim().toLowerCase();
    return activities.filter(
      (a) =>
        (category === "all" || a.category === category) &&
        (!q || a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q))
    );
  }, [activities, query, category]);

  const toggle = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const chosenCost = (activities ?? [])
    .filter((a) => picked.includes(a.id))
    .reduce((sum, a) => sum + a.cost, 0);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setErrors([]);
    try {
      // Sequential on purpose: order_index is assigned per request, and firing
      // these in parallel would make the resulting order arbitrary.
      for (const activityId of picked) {
        await addTripActivity(trip.id, stop.id, { activityId, scheduledDate: day });
      }
      if (customName.trim()) {
        await addTripActivity(trip.id, stop.id, {
          name: customName.trim(),
          scheduledDate: day,
        });
      }
      toast(
        `Added to ${stop.city.name} on ${day}`,
        "success"
      );
      await onAdded();
      onClose();
    } catch (error) {
      setErrors(errorMessages(error));
      setSaving(false);
    }
  };

  const nothingChosen = picked.length === 0 && !customName.trim();

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Add activities in ${stop.city.name}`}
      description={`Anything you pick lands on one day of this stop.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving} disabled={nothingChosen}>
            {picked.length + (customName.trim() ? 1 : 0) > 1
              ? `Add ${picked.length + (customName.trim() ? 1 : 0)} activities`
              : "Add activity"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {errors.length > 0 && (
          <div className="flex gap-2.5 rounded-xl border border-error/30 bg-red-50 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
            <ul className="space-y-0.5 text-sm text-error">
              {errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Day"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            options={days.map((date) => ({ label: date, value: date }))}
          />
          <Select
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={categories.map((c) => ({ label: c === "all" ? "All types" : c, value: c }))}
          />
        </div>

        <Input
          leftIcon={<Search className="h-4 w-4" />}
          placeholder={`Search activities in ${stop.city.name}…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-border p-1.5 scrollbar-thin">
          {activities === null ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-black/5" />
            ))
          ) : filtered.length === 0 ? (
            <p className="p-3 text-sm text-text-muted">
              {activities.length === 0
                ? `The catalogue has no activities for ${stop.city.name} yet. Add one by name below.`
                : "Nothing matches those filters."}
            </p>
          ) : (
            filtered.map((activity) => {
              const active = picked.includes(activity.id);
              return (
                <button
                  key={activity.id}
                  type="button"
                  onClick={() => toggle(activity.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors",
                    active ? "bg-primary-light/60 ring-1 ring-primary" : "hover:bg-surface-muted"
                  )}
                >
                  <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md">
                    <Image
                      src={activity.imageUrl}
                      alt={activity.name}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-text-primary">
                      {activity.name}
                      {alreadyAdded.has(activity.id) && (
                        <span className="ml-2 text-caption font-normal text-text-muted">
                          already on this stop
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 flex items-center gap-2 text-caption text-text-muted">
                      <Badge variant="outline">{activity.category}</Badge>
                      {activity.durationHours > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {pluralize(activity.durationHours, "hr")}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-secondary">
                    {formatCurrency(activity.cost, "USD")}
                  </span>
                  {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              );
            })
          )}
        </div>

        <Input
          label="Or add your own"
          placeholder="e.g. Dinner with Amélie"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          hint="A custom activity has no catalogue price, so it costs 0 until you edit it."
        />

        {chosenCost > 0 && (
          <p className="text-sm text-text-secondary">
            Selected:{" "}
            <span className="font-semibold text-text-primary">
              {formatCurrency(chosenCost, "USD")}
            </span>{" "}
            per person · {formatCurrency(chosenCost * (trip.travelers ?? 1), trip.currency)} for{" "}
            {pluralize(trip.travelers ?? 1, "traveller")}
          </p>
        )}
      </div>
    </Modal>
  );
}
