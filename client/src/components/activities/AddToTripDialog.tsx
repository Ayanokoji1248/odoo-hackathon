"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, MapPinned } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { errorMessages } from "@/lib/api/client";
import { addTripActivity, getTripTree, getTrips, type ApiTripStop } from "@/lib/api/trips";
import { stopDays } from "@/components/itinerary/ActivityPickerDialog";
import { cn } from "@/lib/utils/cn";
import { formatDateRange } from "@/lib/utils/format";
import type { Activity } from "@/types";

interface Candidate {
  tripId: string;
  tripName: string;
  stop: ApiTripStop;
}

/**
 * Attach a catalogue activity to a stop the user already has in that city.
 *
 * The API only accepts an activity whose city matches the stop's, so this offers
 * matching stops rather than every trip: an activity in Paris can only go on a
 * Paris stop. No stop there yet means the honest answer is "add one first".
 */
export function AddToTripDialog({
  activity,
  onClose,
}: {
  activity: Activity;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [stopId, setStopId] = useState("");
  const [day, setDay] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const trips = await getTrips();
        // ponytail: prefilter on city *name* from the cheap list response, then
        // fetch only those trees. The real match below is on city_id, so a
        // same-name city in another country only costs one wasted request.
        const maybe = trips.filter((t) => (t.cityNames ?? []).includes(activity.cityName));
        const trees = await Promise.all(maybe.map((t) => getTripTree(t.id)));
        const found = trees.flatMap((tree) =>
          (tree?.stops ?? [])
            .filter((stop) => stop.city_id === activity.cityId)
            .map((stop) => ({ tripId: tree!.id, tripName: tree!.name, stop }))
        );
        if (!cancelled) setCandidates(found);
      } catch {
        if (!cancelled) setCandidates([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activity.cityId, activity.cityName]);

  const selected = useMemo(
    () => candidates?.find((c) => c.stop.id === stopId),
    [candidates, stopId]
  );
  const days = selected ? stopDays(selected.stop) : [];

  const choose = (candidate: Candidate) => {
    setStopId(candidate.stop.id);
    setDay(stopDays(candidate.stop)[0]);
  };

  const save = async () => {
    if (!selected || saving) return;
    setSaving(true);
    setErrors([]);
    try {
      await addTripActivity(selected.tripId, selected.stop.id, {
        activityId: activity.id,
        scheduledDate: day,
      });
      toast(`Added to ${selected.tripName} on ${day}`, "success");
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
      title={`Add “${activity.name}”`}
      description={`It is in ${activity.cityName}, so it goes on a ${activity.cityName} stop.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving} disabled={!selected || !day}>
            Add to trip
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

        {candidates === null ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-black/5" />
            ))}
          </div>
        ) : candidates.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface-muted p-4 text-center">
            <MapPinned className="mx-auto h-6 w-6 text-text-muted" />
            <p className="mt-2 text-sm text-text-secondary">
              None of your trips stop in {activity.cityName} yet. Add a{" "}
              {activity.cityName} stop to an itinerary, then this activity can go on
              it.
            </p>
            <Link href="/trips" className="mt-3 inline-block">
              <Button size="sm" variant="outline" onClick={onClose}>
                Go to my trips
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              {candidates.map((candidate) => (
                <button
                  key={candidate.stop.id}
                  type="button"
                  onClick={() => choose(candidate)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors",
                    candidate.stop.id === stopId
                      ? "border-primary bg-primary-light/50"
                      : "border-border hover:bg-surface-muted"
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text-primary">
                      {candidate.tripName}
                    </p>
                    <p className="text-caption text-text-muted">
                      {candidate.stop.city.name} ·{" "}
                      {formatDateRange(candidate.stop.start_date, candidate.stop.end_date)}
                    </p>
                  </div>
                  {candidate.stop.id === stopId && (
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                  )}
                </button>
              ))}
            </div>

            {selected && (
              <Select
                label="Day"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                options={days.map((date) => ({ label: date, value: date }))}
              />
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
