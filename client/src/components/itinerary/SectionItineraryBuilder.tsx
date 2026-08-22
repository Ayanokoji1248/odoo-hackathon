"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Save, Share2, MapPin, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { DatePicker } from "@/components/ui/DatePicker";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency } from "@/lib/utils/format";
import type { Trip } from "@/types";

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `s-${Date.now()}-${Math.round(Math.random() * 1e6)}`;

interface Section {
  id: string;
  place: string;
  startDate: string;
  endDate: string;
  budget: number;
  info: string;
}

function seedSections(trip: Trip): Section[] {
  if (trip.stops.length === 0) {
    return [{ id: uid(), place: "", startDate: trip.startDate, endDate: trip.endDate, budget: 0, info: "" }];
  }
  const per = Math.round(trip.estimatedBudget / trip.stops.length);
  return trip.stops.map((s) => ({
    id: uid(),
    place: `${s.cityName}, ${s.country}`,
    startDate: s.startDate,
    endDate: s.endDate,
    budget: per,
    info: "Flights, accommodation and the main activities planned for this stop.",
  }));
}

export function SectionItineraryBuilder({ trip }: { trip: Trip }) {
  const { toast } = useToast();
  const [sections, setSections] = useState<Section[]>(() => seedSections(trip));

  const total = useMemo(() => sections.reduce((s, x) => s + (x.budget || 0), 0), [sections]);

  const update = (id: string, patch: Partial<Section>) =>
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const remove = (id: string) => {
    setSections((prev) => prev.filter((s) => s.id !== id));
    toast("Section removed", "info");
  };

  const move = (index: number, dir: -1 | 1) =>
    setSections((prev) => {
      const next = [...prev];
      const t = index + dir;
      if (t < 0 || t >= next.length) return prev;
      [next[index], next[t]] = [next[t], next[index]];
      return next;
    });

  const add = () =>
    setSections((prev) => [
      ...prev,
      { id: uid(), place: "", startDate: trip.startDate, endDate: trip.endDate, budget: 0, info: "" },
    ]);

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-h3 text-text-primary">Build your itinerary</h1>
          <p className="text-sm text-text-secondary">
            {trip.name} · Estimated total{" "}
            <span className="font-semibold text-text-primary">{formatCurrency(total)}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => toast("Share link copied", "success")}>
            <Share2 className="h-4 w-4" /> Share
          </Button>
          <Button size="sm" onClick={() => toast("Itinerary saved", "success")}>
            <Save className="h-4 w-4" /> Save
          </Button>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-5">
        {sections.map((section, i) => (
          <div key={section.id} className="rounded-2xl border border-border bg-surface shadow-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                  {i + 1}
                </span>
                <h3 className="text-h4 text-text-primary">
                  Section {i + 1}
                  {section.place ? `: ${section.place.split(",")[0]}` : ""}
                </h3>
              </div>
              <div className="flex items-center gap-0.5">
                <button onClick={() => move(i, -1)} aria-label="Move up" className="rounded-lg p-1.5 text-text-muted hover:bg-surface-muted hover:text-text-primary">
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button onClick={() => move(i, 1)} aria-label="Move down" className="rounded-lg p-1.5 text-text-muted hover:bg-surface-muted hover:text-text-primary">
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button onClick={() => remove(section.id)} aria-label="Delete section" className="rounded-lg p-1.5 text-text-muted hover:bg-red-50 hover:text-error">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <Input
                label="Place"
                leftIcon={<MapPin className="h-4 w-4" />}
                placeholder="e.g. London, United Kingdom"
                value={section.place}
                onChange={(e) => update(section.id, { place: e.target.value })}
              />
              <div className="grid gap-4 sm:grid-cols-3">
                <DatePicker label="Start date" value={section.startDate} onChange={(e) => update(section.id, { startDate: e.target.value })} />
                <DatePicker label="End date" value={section.endDate} onChange={(e) => update(section.id, { endDate: e.target.value })} />
                <Input
                  label="Budget of this section (₹)"
                  type="number"
                  leftIcon={<Wallet className="h-4 w-4" />}
                  value={section.budget}
                  onChange={(e) => update(section.id, { budget: Number(e.target.value) || 0 })}
                />
              </div>
              <Textarea
                label="Section details"
                placeholder="All the necessary information about this section — travel, hotel, or any other activity."
                value={section.info}
                onChange={(e) => update(section.id, { info: e.target.value })}
                rows={2}
              />
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={add}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border py-5 text-sm font-medium text-text-secondary transition-colors hover:border-primary hover:bg-primary-light/30 hover:text-primary-hover"
      >
        <Plus className="h-5 w-5" /> Add another Section
      </button>
    </div>
  );
}
