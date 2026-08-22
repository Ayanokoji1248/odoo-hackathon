"use client";

import { useState } from "react";
import Image from "next/image";
import {
  ChevronDown,
  ChevronUp,
  Compass,
  MapPin,
  Pencil,
  Plus,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { StopDialog } from "./StopDialog";
import { ActivityPickerDialog } from "./ActivityPickerDialog";
import { ShareDialog } from "@/components/share/ShareDialog";
import { errorMessages } from "@/lib/api/client";
import {
  deleteStop,
  deleteTripActivity,
  reorderStops,
  type ApiTripStop,
} from "@/lib/api/trips";
import { formatCurrency, formatDateRange, daysBetween, pluralize } from "@/lib/utils/format";
import type { Trip } from "@/types";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1520986606214-8b456906c813?auto=format&fit=crop&w=800&q=80";

/** The day after `iso`, clamped to `max`. Where a new stop starts by default. */
function nextDay(iso: string, max: string): string {
  const day = new Date(iso);
  day.setDate(day.getDate() + 1);
  const next = day.toISOString().slice(0, 10);
  return next > max ? max : next;
}

/**
 * Every stop here is a row in `trip_stops`. There is no local draft: each action
 * is one request and then a refetch of the trip tree, because the API reindexes
 * `order_index` on delete and rewrites every row on reorder - so a client-side
 * copy would be stale the moment either fires.
 */
export function ItineraryBuilder({
  trip,
  stops,
  onChanged,
}: {
  trip: Trip;
  stops: ApiTripStop[];
  onChanged: () => Promise<void> | void;
}) {
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ApiTripStop | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [picking, setPicking] = useState<ApiTripStop | null>(null);
  const [sharing, setSharing] = useState(false);
  const [busy, setBusy] = useState(false);

  const ordered = [...stops].sort((a, b) => a.order_index - b.order_index);
  const travelers = trip.travelers ?? 1;
  const activityCost = (stop: ApiTripStop) =>
    stop.activities.reduce((sum, a) => sum + Number(a.cost), 0) * travelers;
  const total = ordered.reduce((sum, stop) => sum + activityCost(stop), 0);

  const run = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      await onChanged();
    } catch (error) {
      toast(errorMessages(error)[0], "error");
    } finally {
      setBusy(false);
    }
  };

  // The API rejects a partial list, so send every id in the new order.
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    const order = ordered.map((stop) => stop.id);
    [order[index], order[target]] = [order[target], order[index]];
    run(() => reorderStops(trip.id, order));
  };

  const remove = (stopId: string) =>
    run(async () => {
      await deleteStop(trip.id, stopId);
      setConfirming(null);
      toast("Stop removed", "info");
    });

  const removeActivity = (stopId: string, itemId: string, name: string) =>
    run(async () => {
      await deleteTripActivity(trip.id, stopId, itemId);
      toast(`${name} removed`, "info");
    });

  const last = ordered[ordered.length - 1];
  const defaultRange = last
    ? {
        startDate: nextDay(last.end_date, trip.endDate),
        endDate: nextDay(last.end_date, trip.endDate),
      }
    : { startDate: trip.startDate, endDate: trip.endDate };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-h3 text-text-primary">Build your itinerary</h1>
          <p className="text-sm text-text-secondary">
            {pluralize(ordered.length, "stop")} ·{" "}
            {pluralize(
              ordered.reduce((n, stop) => n + stop.activities.length, 0),
              "activity",
              "activities"
            )}{" "}
            · Activities total{" "}
            <span className="font-semibold text-text-primary">
              {formatCurrency(total, trip.currency)}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setSharing(true)}>
            <Share2 className="h-4 w-4" /> {trip.isPublic ? "Sharing" : "Share"}
          </Button>
          <Button size="sm" onClick={() => setAdding(true)} disabled={busy}>
            <Plus className="h-4 w-4" /> Add stop
          </Button>
        </div>
      </div>

      {ordered.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No stops yet"
          description="Add the first city on the route and the dates you will be there."
          action={<Button onClick={() => setAdding(true)}>Add the first stop</Button>}
        />
      ) : (
        <div className="space-y-5">
          {ordered.map((stop, i) => (
            <div
              key={stop.id}
              className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card"
            >
              <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <h3 className="truncate text-h4 text-text-primary">
                    {stop.city.name}
                    <span className="ml-2 text-sm font-normal text-text-muted">
                      {stop.city.country}
                    </span>
                  </h3>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    onClick={() => move(i, -1)}
                    disabled={busy || i === 0}
                    aria-label="Move earlier"
                    className="rounded-lg p-1.5 text-text-muted hover:bg-surface-muted hover:text-text-primary disabled:opacity-30"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={busy || i === ordered.length - 1}
                    aria-label="Move later"
                    className="rounded-lg p-1.5 text-text-muted hover:bg-surface-muted hover:text-text-primary disabled:opacity-30"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setEditing(stop)}
                    disabled={busy}
                    aria-label="Edit stop"
                    className="rounded-lg p-1.5 text-text-muted hover:bg-surface-muted hover:text-text-primary disabled:opacity-30"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setConfirming(stop.id)}
                    disabled={busy}
                    aria-label="Delete stop"
                    className="rounded-lg p-1.5 text-text-muted hover:bg-red-50 hover:text-error disabled:opacity-30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {confirming === stop.id ? (
                <div className="flex flex-wrap items-center justify-between gap-3 bg-red-50 px-5 py-4">
                  <p className="text-sm text-error">
                    Remove {stop.city.name}
                    {stop.activities.length > 0 && (
                      <>
                        {" "}
                        and its{" "}
                        {pluralize(stop.activities.length, "activity", "activities")}
                      </>
                    )}
                    ?
                  </p>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setConfirming(null)}>
                      Cancel
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      loading={busy}
                      onClick={() => remove(stop.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-4 p-5">
                  <div className="relative hidden h-24 w-32 shrink-0 overflow-hidden rounded-xl sm:block">
                    <Image
                      src={stop.city.image_url ?? FALLBACK_IMAGE}
                      alt={stop.city.name}
                      fill
                      className="object-cover"
                      sizes="128px"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text-secondary">
                      {formatDateRange(stop.start_date, stop.end_date)} ·{" "}
                      {pluralize(daysBetween(stop.start_date, stop.end_date), "day")}
                    </p>
                    {stop.notes && (
                      <p className="mt-1.5 text-sm text-text-secondary">{stop.notes}</p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">
                        <Compass className="mr-1 h-3 w-3" />
                        {pluralize(stop.activities.length, "activity", "activities")}
                      </Badge>
                      {activityCost(stop) > 0 && (
                        <Badge>{formatCurrency(activityCost(stop), trip.currency)}</Badge>
                      )}
                    </div>
                    {stop.activities.length > 0 && (
                      <ul className="mt-3 space-y-0.5 border-t border-dashed border-border pt-2">
                        {stop.activities
                          .slice()
                          .sort(
                            (a, b) =>
                              a.scheduled_date.localeCompare(b.scheduled_date) ||
                              a.order_index - b.order_index
                          )
                          .map((activity) => (
                            <li
                              key={activity.id}
                              className="group/act flex items-center gap-3 rounded-lg py-1 pl-1 text-sm hover:bg-surface-muted"
                            >
                              <span className="min-w-0 flex-1 truncate text-text-secondary">
                                <span className="text-text-muted">
                                  {activity.scheduled_date}
                                </span>{" "}
                                · {activity.name}
                              </span>
                              <span className="shrink-0 text-text-muted">
                                {formatCurrency(Number(activity.cost), trip.currency)}
                              </span>
                              <button
                                onClick={() =>
                                  removeActivity(stop.id, activity.id, activity.name)
                                }
                                disabled={busy}
                                aria-label={`Remove ${activity.name}`}
                                className="shrink-0 rounded-md p-1 text-text-muted opacity-0 transition-opacity hover:bg-red-50 hover:text-error focus-visible:opacity-100 group-hover/act:opacity-100 disabled:opacity-30"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </li>
                          ))}
                      </ul>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 -ml-1"
                      disabled={busy}
                      onClick={() => setPicking(stop)}
                    >
                      <Plus className="h-4 w-4" /> Add activity in {stop.city.name}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {ordered.length > 0 && (
        <button
          onClick={() => setAdding(true)}
          disabled={busy}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border py-5 text-sm font-medium text-text-secondary transition-colors hover:border-primary hover:bg-primary-light/30 hover:text-primary-hover disabled:opacity-50"
        >
          <Plus className="h-5 w-5" /> Add another stop
        </button>
      )}

      {adding && (
        <StopDialog
          trip={trip}
          defaultRange={defaultRange}
          onClose={() => setAdding(false)}
          onSaved={onChanged}
        />
      )}
      {editing && (
        <StopDialog
          trip={trip}
          stop={editing}
          onClose={() => setEditing(null)}
          onSaved={onChanged}
        />
      )}
      {picking && (
        <ActivityPickerDialog
          trip={trip}
          stop={picking}
          onClose={() => setPicking(null)}
          onAdded={onChanged}
        />
      )}
      {sharing && (
        <ShareDialog trip={trip} onClose={() => setSharing(false)} onChanged={onChanged} />
      )}
    </div>
  );
}
