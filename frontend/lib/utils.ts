import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: "GHS" = "GHS") {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
  })
    .format(amount)
    .replace("GHS", "GH₵");
}

export function stockLabel(stock: number): { label: string; tone: "in" | "low" | "out" } {
  if (stock <= 0) return { label: "Sold Out", tone: "out" };
  if (stock <= 3) return { label: `Only ${stock} left`, tone: "low" };
  return { label: "In Stock", tone: "in" };
}

/**
 * The choices on a cart line, as one readable string.
 *
 * Lines used to carry a fixed `color`/`size` pair; they now carry whatever
 * options the product actually has, so this joins them generically rather than
 * naming the two that used to exist.
 */
export function describeCartLine(line: {
  options?: Record<string, string>;
  selections?: Record<string, string>;
}): string {
  return [...Object.values(line.options ?? {}), ...Object.values(line.selections ?? {})]
    .filter(Boolean)
    .join(" / ");
}

/** Stable React key / identity for a cart line. */
export function cartLineKey(line: {
  productId: string;
  variantId?: string;
  selections?: Record<string, string>;
}): string {
  const chosen = Object.entries(line.selections ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join(",");
  return `${line.productId}__${line.variantId ?? ""}__${chosen}`;
}

/**
 * How much a piece is reduced by, as a whole percentage.
 *
 * Defined once because three surfaces show it — the shop card, quick view and
 * the product page — and a discount that reads 25% in one place and 26% in
 * another is the kind of small dishonesty customers notice.
 *
 * **Rounded down on purpose.** A saving of 15.8% shown as 16% claims a
 * reduction that was not given; understating it slightly never does. Returns
 * null when there is nothing to announce, so callers render nothing rather than
 * a "0% off" badge.
 */
export function discountPercent(price: number, compareAtPrice?: number): number | null {
  if (!compareAtPrice || compareAtPrice <= price || price < 0) return null;

  const percent = Math.floor(((compareAtPrice - price) / compareAtPrice) * 100);
  return percent >= 1 ? percent : null;
}
