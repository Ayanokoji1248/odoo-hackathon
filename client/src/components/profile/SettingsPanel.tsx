"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, KeyRound, Trash2, User } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useAuth, useUser } from "@/lib/auth/AuthProvider";
import { errorMessages } from "@/lib/api/client";
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  changePassword,
  deleteAccount,
  updateProfile,
} from "@/lib/api/users";
import { cn } from "@/lib/utils/cn";

const SECTIONS = [
  { key: "profile", label: "Profile", icon: User },
  { key: "password", label: "Password", icon: KeyRound },
  { key: "account", label: "Account", icon: Trash2 },
];

/** The `language` column is free text; these are the values the UI offers. */
const LANGUAGES = [
  { label: "English", value: "en" },
  { label: "Hindi", value: "hi" },
  { label: "French", value: "fr" },
  { label: "Spanish", value: "es" },
  { label: "German", value: "de" },
];

function Problems({ messages }: { messages: string[] }) {
  if (messages.length === 0) return null;
  return (
    <div className="flex gap-2.5 rounded-xl border border-error/30 bg-red-50 p-3">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
      <ul className="space-y-0.5 text-sm text-error">
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  );
}

export function SettingsPanel() {
  const [section, setSection] = useState("profile");

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-surface p-2 shadow-card lg:sticky lg:top-24 lg:h-fit lg:flex-col lg:overflow-visible">
        {SECTIONS.map((s) => {
          const active = section === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className={cn(
                "flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition-colors lg:w-full",
                active
                  ? "bg-primary-light text-primary-hover"
                  : "text-text-secondary hover:bg-surface-muted hover:text-text-primary"
              )}
            >
              <s.icon className="h-4 w-4 shrink-0" /> {s.label}
            </button>
          );
        })}
      </nav>

      <div>
        {section === "profile" && <ProfileForm />}
        {section === "password" && <PasswordForm />}
        {section === "account" && <AccountSection />}
      </div>
    </div>
  );
}

function ProfileForm() {
  const user = useUser();
  const { reload } = useAuth();
  const { toast } = useToast();

  // `user.location` is a display-only join of city + country, so it cannot be
  // edited as one field - these are the two real columns behind it.
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [city, setCity] = useState(user.preferences.homeCity ?? "");
  const [country, setCountry] = useState(
    user.location?.split(",").slice(1).join(",").trim() ?? ""
  );
  const [bio, setBio] = useState(user.bio ?? "");
  const [language, setLanguage] = useState(user.preferences.language);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setErrors([]);
    try {
      await updateProfile({ firstName, lastName, phone, city, country, bio, language });
      // The provider holds the user for the whole route group; re-read it so the
      // navbar and profile header change too, not just this form.
      await reload();
      toast("Profile saved", "success");
    } catch (error) {
      setErrors(errorMessages(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="space-y-4">
      <h3 className="text-h4 text-text-primary">Personal information</h3>
      <Problems messages={errors} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="First name"
          value={firstName}
          maxLength={60}
          onChange={(e) => setFirstName(e.target.value)}
        />
        <Input
          label="Last name"
          value={lastName}
          maxLength={60}
          onChange={(e) => setLastName(e.target.value)}
        />
        <Input
          label="Email"
          type="email"
          value={user.email}
          disabled
          hint="Changing the sign-in email needs a verification flow that does not exist yet."
        />
        <Input
          label="Phone number"
          type="tel"
          value={phone}
          maxLength={32}
          onChange={(e) => setPhone(e.target.value)}
          hint="Unique across accounts. Leave it blank to clear it."
        />
        <Input label="City" value={city} maxLength={120} onChange={(e) => setCity(e.target.value)} />
        <Input
          label="Country"
          value={country}
          maxLength={120}
          onChange={(e) => setCountry(e.target.value)}
        />
      </div>
      <Select
        label="Language"
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        options={LANGUAGES}
      />
      <Textarea
        label="Bio"
        rows={3}
        value={bio}
        maxLength={2000}
        onChange={(e) => setBio(e.target.value)}
      />
      <div className="flex justify-end">
        <Button onClick={save} loading={saving} disabled={!firstName.trim() || !lastName.trim()}>
          Save changes
        </Button>
      </div>
    </Card>
  );
}

function PasswordForm() {
  const { logout } = useAuth();
  const { toast } = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const tooShort = next.length > 0 && next.length < PASSWORD_MIN;
  const mismatch = confirm.length > 0 && confirm !== next;

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    setErrors([]);
    try {
      await changePassword(current, next);
      toast("Password changed - sign in again", "success");
      // Every session died, this browser's included. Staying on the page would
      // show a signed-in shell whose next request 401s.
      await logout();
    } catch (error) {
      setErrors(errorMessages(error));
      setSaving(false);
    }
  };

  return (
    <Card className="space-y-4">
      <div>
        <h3 className="text-h4 text-text-primary">Change password</h3>
        {/* Precise on purpose. The API revokes every session row, which kills
            this browser's cookies at once; other devices keep a valid access
            token until it expires (15 min) but can no longer renew it. Saying
            "signed out everywhere immediately" would be wrong. */}
        <p className="mt-1 text-sm text-text-secondary">
          You will be signed out here straight away. Other devices lose access
          within 15 minutes and cannot sign back in without the new password.
        </p>
      </div>
      <Problems messages={errors} />
      <Input
        label="Current password"
        type="password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="New password"
          type="password"
          value={next}
          minLength={PASSWORD_MIN}
          maxLength={PASSWORD_MAX}
          onChange={(e) => setNext(e.target.value)}
          error={tooShort ? `At least ${PASSWORD_MIN} characters` : undefined}
          hint={`${PASSWORD_MIN}-${PASSWORD_MAX} characters`}
        />
        <Input
          label="Confirm new password"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={mismatch ? "Does not match" : undefined}
        />
      </div>
      <div className="flex justify-end">
        <Button
          onClick={submit}
          loading={saving}
          disabled={!current || next.length < PASSWORD_MIN || confirm !== next}
        >
          Change password
        </Button>
      </div>
    </Card>
  );
}

function AccountSection() {
  const user = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    if (deleting) return;
    setDeleting(true);
    setErrors([]);
    try {
      await deleteAccount();
      toast("Account deleted", "info");
      // The row is gone, so there is no session to log out of - just leave.
      router.push("/signup");
    } catch (error) {
      setErrors(errorMessages(error));
      setDeleting(false);
    }
  };

  return (
    <Card>
      <h3 className="text-h4 text-text-primary">Account</h3>
      <p className="mt-1 text-sm text-text-secondary">
        Signed in as {user.email}.
      </p>
      <div className="mt-4 rounded-xl border border-error/30 bg-red-50 p-4">
        <p className="font-medium text-error">Delete account</p>
        <p className="mt-0.5 text-sm text-text-secondary">
          Permanently removes your account and every trip, stop, activity and cost on
          it. There is no undo and no export.
        </p>
        <Button variant="danger" className="mt-3" onClick={() => setConfirming(true)}>
          <Trash2 className="h-4 w-4" /> Delete account
        </Button>
      </div>

      {confirming && (
        <Modal
          open
          onClose={() => setConfirming(false)}
          size="sm"
          title="Delete your account?"
          description="This cannot be undone."
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirming(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={remove}
                loading={deleting}
                disabled={typed.trim().toLowerCase() !== user.email.toLowerCase()}
              >
                Delete forever
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <Problems messages={errors} />
            <p className="text-sm text-text-secondary">
              Type <strong className="text-text-primary">{user.email}</strong> to confirm.
            </p>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={user.email}
              autoComplete="off"
            />
          </div>
        </Modal>
      )}
    </Card>
  );
}
