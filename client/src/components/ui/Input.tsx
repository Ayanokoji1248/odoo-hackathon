import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  /** Interactive trailing control - a password reveal toggle, a unit, a clear button. */
  rightSlot?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leftIcon, rightSlot, id, ...props }, ref) => {
    const inputId = id || props.name;
    // Tying the message to the field means a screen reader reads "Email, invalid,
    // that address is already registered" instead of just "Email".
    const messageId = inputId ? `${inputId}-message` : undefined;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="mb-1.5 block text-sm font-medium text-text-secondary"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20 disabled:cursor-not-allowed disabled:bg-surface-muted",
              leftIcon && "pl-10",
              rightSlot && "pr-11",
              error && "border-error focus:border-error focus:ring-error/20",
              className
            )}
            aria-invalid={!!error}
            aria-describedby={error || hint ? messageId : undefined}
            {...props}
          />
          {rightSlot && (
            <span className="absolute right-1.5 top-1/2 -translate-y-1/2">{rightSlot}</span>
          )}
        </div>
        {error ? (
          // role="alert" so a validation failure is announced, not just coloured.
          <p id={messageId} role="alert" className="mt-1.5 text-xs font-medium text-error">
            {error}
          </p>
        ) : hint ? (
          <p id={messageId} className="mt-1.5 text-xs text-text-muted">
            {hint}
          </p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = "Input";
