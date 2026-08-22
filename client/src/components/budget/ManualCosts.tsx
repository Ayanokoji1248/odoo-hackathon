"use client";

import { useState } from "react";
import { AlertTriangle, CalendarOff, MapPinOff, Pencil, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { errorMessages } from "@/lib/api/client";
import {
  BUDGET_CATEGORIES,
  addBudgetItem,
  budgetCategoryLabel,
  deleteBudgetItem,
  updateBudgetItem,
  type ApiBudgetItem,
  type BudgetItemCategory,
} from "@/lib/api/budget";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import type { Trip } from "@/types";

const NO_STOP = "";

/**
 * Costs the activity catalogue cannot know about: flights, hotels, visas, the
 * taxi from the airport. These are the other half of every budget total on the
 * screen above - activities alone are never the real number.
 *
 * Unlike activity costs, a manual amount is taken **as entered**: a hotel room is
 * not per person, so the API does not multiply it by `travelers`.
 */
export function ManualCosts({
  trip,
  items,
  total,
  currency,
  onChanged,
}: {
  trip: Trip;
  items: ApiBudgetItem[];
  total: number;
  currency: string;
  onChanged: () => Promise<void> | void;
}) {
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ApiBudgetItem | null>(null);
  const [busy, setBusy] = useState(false);

  const stopName = (stopId: string | null) =>
    stopId ? trip.stops.find((s) => s.id === stopId)?.cityName : undefined;

  const remove = async (item: ApiBudgetItem) => {
    if (busy) return;
    setBusy(true);
    try {
      await deleteBudgetItem(trip.id, item.id);
      toast(`${item.label} removed`, "info");
      await onChanged();
    } catch (error) {
      toast(errorMessages(error)[0], "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-h4 text-text-primary">Flights, stays & other costs</h3>
          <p className="text-sm text-text-secondary">
            {items.length === 0
              ? "Anything the activity catalogue cannot price for you."
              : `${items.length} item${items.length > 1 ? "s" : ""} · ${formatCurrency(
                  total,
                  currency
                )} — entered as a total, not per traveller.`}
          </p>
        </div>
        <Button size="sm" onClick={() => setAdding(true)} disabled={busy}>
          <Plus className="h-4 w-4" /> Add cost
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-text-muted">
          No manual costs yet. Add a flight or a hotel and every total on this page
          moves with it.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => {
            const city = stopName(item.trip_stop_id);
            return (
              <li key={item.id} className="group/row flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium text-text-primary">
                    <span className="truncate">{item.label}</span>
                    <Badge variant="outline">{budgetCategoryLabel(item.category)}</Badge>
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-text-muted">
                    {item.incurred_on ? (
                      formatDate(item.incurred_on, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    ) : (
                      <span className="flex items-center gap-1">
                        <CalendarOff className="h-3 w-3" /> no date — not on the daily chart
                      </span>
                    )}
                    {city ? (
                      <span>{city}</span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <MapPinOff className="h-3 w-3" /> no city
                      </span>
                    )}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-secondary">
                  {formatCurrency(Number(item.amount), currency)}
                </span>
                <button
                  onClick={() => setEditing(item)}
                  disabled={busy}
                  aria-label={`Edit ${item.label}`}
                  className="shrink-0 rounded-md p-1.5 text-text-muted opacity-0 transition-opacity hover:bg-surface-muted hover:text-text-primary focus-visible:opacity-100 group-hover/row:opacity-100 disabled:opacity-30"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => remove(item)}
                  disabled={busy}
                  aria-label={`Remove ${item.label}`}
                  className="shrink-0 rounded-md p-1.5 text-text-muted opacity-0 transition-opacity hover:bg-red-50 hover:text-error focus-visible:opacity-100 group-hover/row:opacity-100 disabled:opacity-30"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {adding && (
        <CostDialog trip={trip} onClose={() => setAdding(false)} onSaved={onChanged} />
      )}
      {editing && (
        <CostDialog
          trip={trip}
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={onChanged}
        />
      )}
    </Card>
  );
}

/** Add when `item` is absent, edit when it is present. Same five fields either way. */
function CostDialog({
  trip,
  item,
  onClose,
  onSaved,
}: {
  trip: Trip;
  item?: ApiBudgetItem;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const { toast } = useToast();
  const [category, setCategory] = useState<BudgetItemCategory>(
    (item?.category as BudgetItemCategory) ?? "TRANSPORT"
  );
  const [label, setLabel] = useState(item?.label ?? "");
  // A string, not a number: an empty input must stay empty rather than snap to 0.
  const [amount, setAmount] = useState(item ? String(Number(item.amount)) : "");
  const [incurredOn, setIncurredOn] = useState(item?.incurred_on ?? "");
  const [stopId, setStopId] = useState(item?.trip_stop_id ?? NO_STOP);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const parsed = Number(amount);
  const badAmount = amount !== "" && (!Number.isFinite(parsed) || parsed < 0);
  const outsideTrip =
    !!incurredOn && (incurredOn < trip.startDate || incurredOn > trip.endDate);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setErrors([]);
    try {
      const payload = {
        category,
        label: label.trim(),
        amount: parsed,
        incurredOn,
        tripStopId: stopId,
      };
      if (item) await updateBudgetItem(trip.id, item.id, payload);
      else await addBudgetItem(trip.id, payload);
      toast(item ? "Cost updated" : `${payload.label} added`, "success");
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
      title={item ? "Edit cost" : "Add a cost"}
      description="Flights, accommodation, visas — anything priced outside the activity catalogue."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={save}
            loading={saving}
            disabled={!label.trim() || amount === "" || badAmount || outsideTrip}
          >
            {item ? "Save cost" : "Add cost"}
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
          label="What is it"
          placeholder="e.g. Return flights, Hotel Le Marais"
          value={label}
          maxLength={160}
          onChange={(e) => setLabel(e.target.value)}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value as BudgetItemCategory)}
            options={BUDGET_CATEGORIES.map((c) => ({ label: c.label, value: c.value }))}
          />
          <Input
            label={`Amount (${trip.currency ?? "USD"})`}
            type="number"
            min={0}
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={badAmount ? "Must be zero or more" : undefined}
            hint="A total, not per traveller."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <DatePicker
            label="Date (optional)"
            value={incurredOn}
            min={trip.startDate}
            max={trip.endDate}
            onChange={(e) => setIncurredOn(e.target.value)}
            error={outsideTrip ? "Outside the trip dates" : undefined}
          />
          <Select
            label="City (optional)"
            value={stopId}
            onChange={(e) => setStopId(e.target.value)}
            options={[
              { label: "Not tied to a city", value: NO_STOP },
              ...trip.stops.map((s) => ({
                label: `${s.cityName} (${s.startDate} → ${s.endDate})`,
                value: s.id,
              })),
            ]}
          />
        </div>

        <p className="text-caption text-text-muted">
          Both are optional. Without a date it still counts in the total but cannot
          appear on the daily chart; without a city it shows as unassigned in the
          per-city split.
        </p>
      </div>
    </Modal>
  );
}
