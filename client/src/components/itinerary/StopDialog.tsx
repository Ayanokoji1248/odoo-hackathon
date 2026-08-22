"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { AlertTriangle, Check, Search } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { DatePicker } from "@/components/ui/DatePicker";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { getCities } from "@/lib/api/cities";
import { errorMessages } from "@/lib/api/client";
import { addStop, updateStop, type ApiTripStop } from "@/lib/api/trips";
import { cn } from "@/lib/utils/cn";
import type { City, Trip } from "@/types";

/**
 * Add or edit one stop. `stop` absent means add.
 *
 * The API validates stop dates against the *trip* range, so the pickers are
 * clamped to it rather than letting the user earn a 422. Overlaps between stops
 * are legal - the API returns them as `warnings`, which surface as a toast.
 */
export function StopDialog({
  trip,
  stop,
  defaultRange,
  onClose,
  onSaved,
}: {
  trip: Trip;
  stop?: ApiTripStop;
  /** Where a new stop starts: the day after the last one, clamped to the trip. */
  defaultRange?: { startDate: string; endDate: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [cities, setCities] = useState<City[] | null>(null);
  const [query, setQuery] = useState("");
  const [cityId, setCityId] = useState(stop?.city_id ?? "");
  const [startDate, setStartDate] = useState(
    stop?.start_date ?? defaultRange?.startDate ?? trip.startDate
  );
  const [endDate, setEndDate] = useState(
    stop?.end_date ?? defaultRange?.endDate ?? trip.endDate
  );
  const [notes, setNotes] = useState(stop?.notes ?? "");
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCities().then(setCities).catch(() => setCities([]));
  }, []);

  const filtered = useMemo(() => {
    if (!cities) return [];
    const q = query.trim().toLowerCase();
    const matches = q
      ? cities.filter(
          (c) =>
            c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q)
        )
      : cities;
    // Keep the chosen city visible even when the search would exclude it.
    const chosen = cities.find((c) => c.id === cityId);
    return chosen && !matches.some((c) => c.id === cityId)
      ? [chosen, ...matches]
      : matches;
  }, [cities, query, cityId]);

  const badRange = endDate < startDate;
  const outsideTrip = startDate < trip.startDate || endDate > trip.endDate;

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setErrors([]);
    try {
      const { warnings } = stop
        ? await updateStop(trip.id, stop.id, { cityId, startDate, endDate, notes })
        : await addStop(trip.id, { cityId, startDate, endDate, notes });
      toast(stop ? "Stop updated" : "Stop added", "success");
      // Advisory, never blocking - travel days genuinely overlap.
      warnings.forEach((w) => toast(w, "info"));
      onSaved();
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
      title={stop ? "Edit stop" : "Add a stop"}
      description={`Anywhere between ${trip.startDate} and ${trip.endDate}.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={save}
            loading={saving}
            disabled={!cityId || badRange || outsideTrip}
          >
            {stop ? "Save stop" : "Add stop"}
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

        <div>
          <Input
            label="City"
            leftIcon={<Search className="h-4 w-4" />}
            placeholder="Search the catalogue…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-xl border border-border p-1.5 scrollbar-thin">
            {cities === null ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-black/5" />
              ))
            ) : filtered.length === 0 ? (
              <p className="p-3 text-sm text-text-muted">
                No city matches “{query}”. The catalogue holds {cities.length}.
              </p>
            ) : (
              filtered.map((city) => (
                <button
                  key={city.id}
                  type="button"
                  onClick={() => setCityId(city.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors",
                    city.id === cityId
                      ? "bg-primary-light/60 ring-1 ring-primary"
                      : "hover:bg-surface-muted"
                  )}
                >
                  <div className="relative h-10 w-14 shrink-0 overflow-hidden rounded-md">
                    <Image
                      src={city.imageUrl}
                      alt={city.name}
                      fill
                      className="object-cover"
                      sizes="56px"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-text-primary">
                      {city.name}
                    </p>
                    <p className="truncate text-caption text-text-muted">{city.country}</p>
                  </div>
                  <Badge variant="outline">{city.costIndex}</Badge>
                  {city.id === cityId && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <DatePicker
            label="Arrive"
            value={startDate}
            min={trip.startDate}
            max={trip.endDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <DatePicker
            label="Leave"
            value={endDate}
            min={startDate || trip.startDate}
            max={trip.endDate}
            onChange={(e) => setEndDate(e.target.value)}
            error={
              badRange
                ? "Cannot leave before arriving"
                : outsideTrip
                  ? "Outside the trip dates"
                  : undefined
            }
          />
        </div>

        <Textarea
          label="Notes"
          rows={2}
          placeholder="Hotel, transport, anything worth remembering."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </Modal>
  );
}
