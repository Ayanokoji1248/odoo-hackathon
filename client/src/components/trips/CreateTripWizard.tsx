"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { DatePicker } from "@/components/ui/DatePicker";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { mockCities } from "@/data/mock/cities";
import { mockActivities } from "@/data/mock/activities";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/format";

const STEPS = ["Basic Info", "Destinations", "Activities", "Budget", "Review"];

export function CreateTripWizard() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [cityIds, setCityIds] = useState<string[]>([]);
  const [activityIds, setActivityIds] = useState<string[]>([]);
  const [budget, setBudget] = useState("100000");

  const selectedCities = mockCities.filter((c) => cityIds.includes(c.id));
  const relevantActivities = mockActivities.filter((a) => cityIds.includes(a.cityId));
  const selectedActivities = mockActivities.filter((a) => activityIds.includes(a.id));

  const toggleCity = (id: string) =>
    setCityIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const toggleActivity = (id: string) =>
    setActivityIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const canNext =
    (step === 0 && name && startDate && endDate) ||
    (step === 1 && cityIds.length > 0) ||
    step === 2 ||
    step === 3 ||
    step === 4;

  const finish = () => {
    toast("Trip created successfully! 🎉", "success");
    setTimeout(() => router.push("/trips"), 700);
  };

  return (
    <div>
      {/* Stepper */}
      <div className="mb-8 flex items-center">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                  i < step && "bg-primary text-white",
                  i === step && "bg-primary text-white ring-4 ring-primary-light",
                  i > step && "border-2 border-border bg-surface text-text-muted"
                )}
              >
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  "mt-1.5 hidden text-caption font-medium sm:block",
                  i <= step ? "text-text-primary" : "text-text-muted"
                )}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "mx-2 h-0.5 flex-1 rounded-full",
                  i < step ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </div>
        ))}
      </div>

      <Card padded>
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-h3 text-text-primary">Basic Info</h2>
            <Input
              label="Trip name"
              placeholder="e.g. Europe Adventure"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <DatePicker label="Start date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <DatePicker label="End date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <Textarea
              label="Description"
              placeholder="What's this trip about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="mb-1 text-h3 text-text-primary">Destinations</h2>
            <p className="mb-4 text-sm text-text-secondary">
              Pick the cities you&apos;ll visit. {cityIds.length} selected.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {mockCities.map((city) => {
                const active = cityIds.includes(city.id);
                return (
                  <button
                    key={city.id}
                    onClick={() => toggleCity(city.id)}
                    className={cn(
                      "group relative aspect-4/3 overflow-hidden rounded-xl text-left ring-2 ring-offset-1 transition-all",
                      active ? "ring-primary" : "ring-transparent hover:ring-border"
                    )}
                  >
                    <Image src={city.imageUrl} alt={city.name} fill className="object-cover transition-transform duration-500 group-hover:scale-105" sizes="(max-width:640px) 50vw, 200px" />
                    <div className="absolute inset-0 bg-linear-to-t from-slate-900/75 to-transparent" />
                    {active && (
                      <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                    <div className="absolute inset-x-0 bottom-0 p-2 text-white">
                      <p className="truncate text-sm font-semibold leading-tight">{city.name}</p>
                      <p className="truncate text-caption text-white/80">{city.country}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="mb-1 text-h3 text-text-primary">Activities</h2>
            <p className="mb-4 text-sm text-text-secondary">
              {relevantActivities.length === 0
                ? "Select destinations first to see activities."
                : `Add things to do. ${activityIds.length} selected.`}
            </p>
            <div className="space-y-2">
              {relevantActivities.map((a) => {
                const active = activityIds.includes(a.id);
                return (
                  <button
                    key={a.id}
                    onClick={() => toggleActivity(a.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                      active ? "border-primary bg-primary-light/40" : "border-border hover:bg-surface-muted"
                    )}
                  >
                    <Image src={a.imageUrl} alt={a.name} width={48} height={48} className="h-12 w-12 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-text-primary">{a.name}</p>
                      <p className="text-caption text-text-muted">{a.cityName} · {a.category}</p>
                    </div>
                    <span className="text-sm font-medium text-text-secondary">
                      {a.cost === 0 ? "Free" : formatCurrency(a.cost)}
                    </span>
                    <span className={cn("flex h-6 w-6 items-center justify-center rounded-full", active ? "bg-primary text-white" : "bg-surface-muted text-text-muted")}>
                      {active ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-h3 text-text-primary">Budget</h2>
            <Input
              label="Estimated total budget (₹)"
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
            <p className="text-sm text-text-secondary">
              Selected activities cost{" "}
              <span className="font-semibold text-text-primary">
                {formatCurrency(selectedActivities.reduce((s, a) => s + a.cost, 0))}
              </span>
              . We&apos;ll help you refine this later in the budget planner.
            </p>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-h3 text-text-primary">Review</h2>
            <div className="rounded-xl bg-surface-muted p-4">
              <p className="text-h4 text-text-primary">{name || "Untitled trip"}</p>
              {description && <p className="mt-1 text-sm text-text-secondary">{description}</p>}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {selectedCities.map((c) => (
                  <Badge key={c.id} variant="primary">{c.name}</Badge>
                ))}
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-text-muted">Dates</dt><dd className="font-medium text-text-primary">{startDate || "—"} → {endDate || "—"}</dd></div>
              <div><dt className="text-text-muted">Cities</dt><dd className="font-medium text-text-primary">{selectedCities.length}</dd></div>
              <div><dt className="text-text-muted">Activities</dt><dd className="font-medium text-text-primary">{selectedActivities.length}</dd></div>
              <div><dt className="text-text-muted">Budget</dt><dd className="font-medium text-text-primary">{formatCurrency(Number(budget) || 0)}</dd></div>
            </dl>
          </div>
        )}
      </Card>

      {/* Controls */}
      <div className="mt-6 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={finish}>
            <Check className="h-4 w-4" /> Create Trip
          </Button>
        )}
      </div>
    </div>
  );
}
