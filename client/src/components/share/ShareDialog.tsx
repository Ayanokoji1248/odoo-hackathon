"use client";

import { useState } from "react";
import { AlertTriangle, Check, Copy, Globe, Lock } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { errorMessages } from "@/lib/api/client";
import { shareTrip, shareUrl, unshareTrip } from "@/lib/api/shares";
import type { Trip } from "@/types";

/**
 * The share control for a trip the user owns.
 *
 * Sharing is idempotent server-side, so re-opening this dialog never rotates a
 * link somebody already has. Un-sharing is the opposite: it clears the slug, so
 * the old link is dead for good and sharing again mints a new one. That is worth
 * saying on screen, because "make private then public again" reads like it should
 * be reversible and is not.
 */
export function ShareDialog({
  trip,
  onClose,
  onChanged,
}: {
  trip: Trip;
  onClose: () => void;
  /** So the card or header that opened this can pick up the new is_public state. */
  onChanged?: () => Promise<void> | void;
}) {
  const { toast } = useToast();
  const [slug, setSlug] = useState(trip.shareToken);
  const [isPublic, setIsPublic] = useState(trip.isPublic);
  const [copied, setCopied] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const url = slug ? shareUrl(slug) : "";

  const run = async (action: () => Promise<{ isPublic: boolean; shareSlug?: string }>) => {
    if (busy) return;
    setBusy(true);
    setErrors([]);
    try {
      const state = await action();
      setIsPublic(state.isPublic);
      setSlug(state.shareSlug);
      setCopied(false);
      await onChanged?.();
    } catch (error) {
      setErrors(errorMessages(error));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast("Link copied", "success");
    } catch {
      // Clipboard access needs a secure context and can be denied outright.
      // Selecting the field is a real fallback; a success toast would be a lie.
      toast("Could not reach the clipboard - copy the link by hand", "error");
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Share this trip"
      description={
        isPublic
          ? "Anyone with the link can view a read-only copy of this itinerary."
          : "This trip is private. Nobody else can see it."
      }
      footer={
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Done
        </Button>
      }
    >
      <div className="space-y-4">
        {errors.length > 0 && (
          <div className="flex gap-2.5 rounded-xl border border-error/30 bg-red-50 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
            <ul className="space-y-0.5 text-sm text-error">
              {errors.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-muted p-4">
          <span
            className={
              isPublic
                ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-50 text-success"
                : "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-text-muted"
            }
          >
            {isPublic ? <Globe className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text-primary">
              {isPublic ? "Public link is on" : "Private"}
            </p>
            <p className="mt-0.5 text-caption text-text-muted">
              {isPublic
                ? "Viewers see the itinerary and budget, and can copy it into their own account. They never see your email or contact details."
                : "Turn this on to get a link you can send to anyone."}
            </p>
          </div>
        </div>

        {isPublic && slug ? (
          <>
            <div className="flex items-end gap-2">
              <Input
                label="Share link"
                value={url}
                readOnly
                onFocus={(e) => e.currentTarget.select()}
                className="font-mono text-xs"
              />
              <Button variant="outline" onClick={copy} className="shrink-0">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <Button
              variant="outline"
              className="w-full"
              loading={busy}
              onClick={() => run(() => unshareTrip(trip.id))}
            >
              <Lock className="h-4 w-4" /> Make private
            </Button>
            <p className="text-caption text-text-muted">
              Making it private kills this link permanently. Sharing again later
              creates a different one, so anyone holding the old link stays locked
              out.
            </p>
          </>
        ) : (
          <Button
            className="w-full"
            loading={busy}
            onClick={() => run(() => shareTrip(trip.id))}
          >
            <Globe className="h-4 w-4" /> Create a public link
          </Button>
        )}
      </div>
    </Modal>
  );
}
