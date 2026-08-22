"use client";

import { Search, LayoutGrid, SlidersHorizontal, ArrowDownWideNarrow } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface ToolbarOption {
  label: string;
  value: string;
}

interface FilterToolbarProps {
  query?: string;
  onQueryChange?: (v: string) => void;
  placeholder?: string;
  groupBy?: { value: string; options: ToolbarOption[]; onChange: (v: string) => void };
  filterBy?: { value: string; options: ToolbarOption[]; onChange: (v: string) => void };
  sortBy?: { value: string; options: ToolbarOption[]; onChange: (v: string) => void };
  className?: string;
}

function Dropdown({
  icon: Icon,
  label,
  value,
  options,
  onChange,
}: {
  icon: typeof LayoutGrid;
  label: string;
  value: string;
  options: ToolbarOption[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 appearance-none rounded-xl border border-border bg-surface pl-9 pr-8 text-sm font-medium text-text-secondary transition-colors hover:border-primary/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {label}: {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Search + Group by + Filter + Sort by — the recurring toolbar from the wireframe. */
export function FilterToolbar({
  query,
  onQueryChange,
  placeholder = "Search…",
  groupBy,
  filterBy,
  sortBy,
  className,
}: FilterToolbarProps) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center", className)}>
      {onQueryChange && (
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={placeholder}
            className="h-11 w-full rounded-xl border border-border bg-surface pl-10 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {groupBy && <Dropdown icon={LayoutGrid} label="Group by" {...groupBy} />}
        {filterBy && <Dropdown icon={SlidersHorizontal} label="Filter" {...filterBy} />}
        {sortBy && <Dropdown icon={ArrowDownWideNarrow} label="Sort" {...sortBy} />}
      </div>
    </div>
  );
}
