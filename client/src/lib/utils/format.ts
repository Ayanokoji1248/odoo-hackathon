/** Formatting helpers used across the app. */

export function formatCurrency(amount: number, currency = "INR"): string {
  const locale = currency === "INR" ? "en-IN" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(
  date: string | Date,
  opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", opts).format(d);
}

export function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "";
  const sameYear = s.getFullYear() === e.getFullYear();
  const startStr = formatDate(s, { month: "short", day: "numeric" });
  const endStr = formatDate(e, {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
  return `${startStr} – ${endStr}${sameYear ? `, ${e.getFullYear()}` : ""}`;
}

/** Inclusive number of days between two ISO dates. */
export function daysBetween(start: string, end: string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) return 0;
  return Math.max(1, Math.round((e - s) / 86_400_000) + 1);
}

/** Return an array of ISO date strings from start to end inclusive. */
export function dateSpan(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return out;
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : plural ?? `${singular}s`}`;
}

/** Deterministic pseudo-discount % from a stable seed (so it never changes / no hydration mismatch). */
export function pseudoDiscount(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const options = [0, 0, 10, 15, 20, 20, 25, 30];
  return options[h % options.length];
}

/** Original (strike-through) price implied by a discounted price. */
export function strikePrice(price: number, pct: number): number {
  if (pct <= 0 || price <= 0) return 0;
  return Math.round(price / (1 - pct / 100) / 50) * 50;
}

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
