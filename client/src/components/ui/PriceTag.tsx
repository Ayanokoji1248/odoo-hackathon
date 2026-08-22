import { formatCurrency, pseudoDiscount, strikePrice } from "@/lib/utils/format";

interface PriceTagProps {
  price: number;
  seed?: string;
  unit?: string;
  /** Show a pseudo discount % + strikeout (catalog items only). */
  discount?: boolean;
  /** ISO-4217. Catalog data from the API is USD. */
  currency?: string;
}

/** Tour-card style price: optional "% OFF" badge + strikeout, then a big bold price. */
export function PriceTag({ price, seed = "", unit, discount = false, currency = "USD" }: PriceTagProps) {
  if (price <= 0) {
    return <p className="text-xl font-extrabold leading-none text-success">Free</p>;
  }
  const pct = discount ? pseudoDiscount(seed) : 0;
  const strike = strikePrice(price, pct);

  return (
    <div>
      {pct > 0 && (
        <div className="mb-1 flex items-center gap-2">
          <span className="rounded bg-linear-to-b from-[#f4b400] to-[#f97316] px-1.5 py-0.5 text-[11px] font-extrabold leading-none text-white">
            {pct}% OFF
          </span>
          <del className="text-sm text-text-muted">{formatCurrency(strike, currency)}</del>
        </div>
      )}
      <p className="flex items-baseline gap-1">
        <span className="text-2xl font-extrabold leading-none text-secondary">
          {formatCurrency(price, currency)}
        </span>
        {unit && <span className="text-[11px] text-text-muted">{unit}</span>}
      </p>
    </div>
  );
}
