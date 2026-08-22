"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Input, type InputProps } from "@/components/ui/Input";

/**
 * A password input you can actually read back.
 *
 * Typing a password blind is the single biggest cause of failed sign-ins, and a
 * reveal toggle is a better answer than a "confirm password" field: it lets people
 * check what they typed instead of typing it twice and getting both wrong.
 *
 * The toggle is a real `<button>` with `aria-pressed`, not a click handler on an
 * icon, so it is reachable by keyboard and announced as a toggle.
 */
export function PasswordField({
  label = "Password",
  ...props
}: Omit<InputProps, "type" | "leftIcon" | "rightSlot">) {
  const [visible, setVisible] = useState(false);

  return (
    <Input
      {...props}
      label={label}
      type={visible ? "text" : "password"}
      leftIcon={<Lock className="h-4 w-4" />}
      // Never let a password manager or the browser save a revealed field as text.
      spellCheck={false}
      autoCapitalize="off"
      rightSlot={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? "Hide password" : "Show password"}
          title={visible ? "Hide password" : "Show password"}
          className="rounded-lg p-2 text-text-muted transition-colors hover:bg-surface-muted hover:text-text-primary"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      }
    />
  );
}
