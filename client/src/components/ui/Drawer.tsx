"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  side?: "left" | "right";
}

export function Drawer({ open, onClose, title, children, side = "left" }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[95]">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "absolute top-0 h-full w-[82%] max-w-xs bg-surface shadow-pop transition-transform",
          side === "left" ? "left-0 animate-fade-in" : "right-0 animate-slide-in-right"
        )}
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <span className="text-h4 text-text-primary">{title}</span>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-lg p-1.5 text-text-muted hover:bg-surface-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="h-[calc(100%-57px)] overflow-y-auto p-4 scrollbar-thin">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
