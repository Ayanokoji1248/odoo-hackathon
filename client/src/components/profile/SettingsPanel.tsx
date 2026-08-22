"use client";

import { useState } from "react";
import { User, SlidersHorizontal, Shield, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { mockUser } from "@/data/mock/users";
import { cn } from "@/lib/utils/cn";
import type { TravelStyle } from "@/types";

const SECTIONS = [
  { key: "profile", label: "Profile", icon: User },
  { key: "preferences", label: "Preferences", icon: SlidersHorizontal },
  { key: "privacy", label: "Privacy", icon: Shield },
  { key: "account", label: "Account", icon: Trash2 },
];

const STYLES: TravelStyle[] = ["Adventure", "Relaxation", "Culture", "Food", "Nature", "Budget", "Luxury", "Family"];

function Toggle({ label, defaultOn }: { label: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(!!defaultOn);
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-text-secondary">{label}</span>
      <button
        onClick={() => setOn((o) => !o)}
        role="switch"
        aria-checked={on}
        className={cn("relative h-6 w-11 rounded-full transition-colors", on ? "bg-primary" : "bg-border")}
      >
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", on ? "translate-x-5" : "translate-x-0.5")} />
      </button>
    </div>
  );
}

export function SettingsPanel() {
  const { toast } = useToast();
  const [section, setSection] = useState("profile");
  const [styles, setStyles] = useState<TravelStyle[]>(mockUser.preferences.travelStyle);

  const toggleStyle = (s: TravelStyle) =>
    setStyles((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      {/* Side nav */}
      <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSection(s.key)}
            className={cn(
              "flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              section === s.key ? "bg-primary-light text-primary-hover" : "text-text-secondary hover:bg-surface-muted"
            )}
          >
            <s.icon className="h-4 w-4" /> {s.label}
          </button>
        ))}
      </nav>

      <div>
        {section === "profile" && (
          <Card className="space-y-4">
            <h3 className="text-h4 text-text-primary">Personal Information</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Full name" defaultValue={mockUser.name} />
              <Input label="Email" type="email" defaultValue={mockUser.email} />
              <Input label="Location" defaultValue={mockUser.location} />
              <Input label="Home city" defaultValue={mockUser.preferences.homeCity} />
            </div>
            <Textarea label="Bio" defaultValue={mockUser.bio} />
            <div className="flex justify-end">
              <Button onClick={() => toast("Profile saved", "success")}>Save changes</Button>
            </div>
          </Card>
        )}

        {section === "preferences" && (
          <Card className="space-y-4">
            <h3 className="text-h4 text-text-primary">Travel Preferences</h3>
            <div>
              <p className="mb-2 text-sm font-medium text-text-secondary">Travel style</p>
              <div className="flex flex-wrap gap-2">
                {STYLES.map((s) => (
                  <button key={s} onClick={() => toggleStyle(s)}>
                    <Badge variant={styles.includes(s) ? "primary" : "outline"} className="cursor-pointer px-3 py-1">
                      {s}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Currency" defaultValue={mockUser.preferences.currency} options={[{ label: "INR (₹)", value: "INR" }, { label: "USD ($)", value: "USD" }, { label: "EUR (€)", value: "EUR" }]} />
              <Select label="Language" defaultValue={mockUser.preferences.language} options={[{ label: "English", value: "English" }, { label: "Hindi", value: "Hindi" }]} />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => toast("Preferences saved", "success")}>Save changes</Button>
            </div>
          </Card>
        )}

        {section === "privacy" && (
          <Card>
            <h3 className="text-h4 text-text-primary">Privacy</h3>
            <div className="mt-2 divide-y divide-border">
              <Toggle label="Public profile" defaultOn={mockUser.preferences.publicProfile} />
              <Toggle label="Show trips on public profile" defaultOn />
              <Toggle label="Allow others to copy my shared trips" defaultOn />
              <Toggle label="Email notifications" defaultOn={mockUser.preferences.emailNotifications} />
            </div>
          </Card>
        )}

        {section === "account" && (
          <Card>
            <h3 className="text-h4 text-text-primary">Account</h3>
            <p className="mt-1 text-sm text-text-secondary">Manage your account and data.</p>
            <div className="mt-4 space-y-3">
              <Button variant="outline" onClick={() => toast("Password reset link sent", "info")}>Change password</Button>
              <div className="rounded-xl border border-error/30 bg-red-50 p-4">
                <p className="font-medium text-error">Delete account</p>
                <p className="mt-0.5 text-sm text-text-secondary">This permanently removes all your trips and data.</p>
                <Button variant="danger" className="mt-3" onClick={() => toast("Account deletion is disabled in the demo", "warning")}>
                  <Trash2 className="h-4 w-4" /> Delete account
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
