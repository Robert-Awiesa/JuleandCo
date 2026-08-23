import { cn, formatCurrency } from "@/lib/utils";

interface PriceTagProps {
  price: number;
  compareAtPrice?: number;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClass = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-2xl",
};

export function PriceTag({ price, compareAtPrice, className, size = "md" }: PriceTagProps) {
  return (
    // `numeric` pins this to Roboto with tabular figures even when it sits
    // inside a serif block — Playfair’s figures read as decorative, which is
    // wrong for a price.
    <span className={cn("numeric inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5", sizeClass[size], className)}>
      <span className="font-medium">{formatCurrency(price)}</span>
      {compareAtPrice && compareAtPrice > price && (
        <span className="text-ink-subtle line-through text-[0.85em]">
          {formatCurrency(compareAtPrice)}
        </span>
      )}
    </span>
  );
}
