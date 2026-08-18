export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
  })
    .format(amount)
    .replace("GHS", "GH₵");
}

export function stockTone(stock: number): "in" | "low" | "out" {
  if (stock <= 0) return "out";
  if (stock <= 5) return "low";
  return "in";
}
