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
