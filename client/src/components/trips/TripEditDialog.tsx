"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { DatePicker } from "@/components/ui/DatePicker";
import { useToast } from "@/components/ui/Toast";
import { errorMessages } from "@/lib/api/client";
import { deleteTrip, updateTrip } from "@/lib/api/trips";
import type { Trip } from "@/types";

/** Mounted only while open (`{editing && <TripEditDialog …/>}`), so every open
 *  starts from the trip's current values without an effect to reset them. */
export function TripEditDialog({
  trip,
  onClose,
  onSaved,
}: {
  trip: Trip;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(trip.name);
  const [description, setDescription] = useState(trip.description ?? "");
  const [startDate, setStartDate] = useState(trip.startDate);
  const [endDate, setEndDate] = useState(trip.endDate);
  const [travelers, setTravelers] = useState(trip.travelers ?? 1);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const badRange = !!startDate && !!endDate && endDate < startDate;

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setErrors([]);
    try {
      await updateTrip(trip.id, { name, description, startDate, endDate, travelers });
      toast("Trip updated", "success");
      onSaved?.();
      onClose();
    } catch (error) {
      setErrors(errorMessages(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit trip"
      description="Name, dates and travellers. Stops and activities live in the itinerary."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving} disabled={!name.trim() || badRange}>
            Save changes
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

        <Input
          label="Trip name"
          value={name}
          maxLength={160}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <DatePicker
            label="Start date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <DatePicker
            label="End date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            error={badRange ? "Cannot end before it starts" : undefined}
          />
        </div>
        <Input
          label="Travellers"
          type="number"
          min={1}
          max={99}
          value={travelers}
          onChange={(e) => setTravelers(Math.max(1, Number(e.target.value) || 1))}
          hint="Activity costs are per person and scale with this."
        />
        <Textarea
          label="Description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
    </Modal>
  );
}

export function TripDeleteDialog({
  trip,
  onClose,
  onDeleted,
}: {
  trip: Trip;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);

  const confirm = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteTrip(trip.id);
      toast(`"${trip.name}" deleted`, "info");
      onDeleted?.();
      onClose();
    } catch (error) {
      toast(errorMessages(error)[0], "error");
      setDeleting(false);
    }
  };

  const stops = trip.stopCount ?? trip.stops.length;

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`Delete "${trip.name}"?`}
      description="This cannot be undone."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirm} loading={deleting}>
            Delete trip
          </Button>
        </>
      }
    >
      <p className="text-sm text-text-secondary">
        {stops > 0 || trip.activityCount > 0 ? (
          <>
            Its {stops} {stops === 1 ? "stop" : "stops"}, {trip.activityCount}{" "}
            {trip.activityCount === 1 ? "activity" : "activities"} and every budget
            item go with it.
          </>
        ) : (
          <>The trip is empty, so nothing else goes with it.</>
        )}
      </p>
    </Modal>
  );
}
