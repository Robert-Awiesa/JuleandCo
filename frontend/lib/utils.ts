import { type ClassValue, clsx } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
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
