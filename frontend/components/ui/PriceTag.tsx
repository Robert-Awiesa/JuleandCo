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
    <span className={cn("inline-flex items-baseline gap-2", sizeClass[size], className)}>
      <span className="font-medium">{formatCurrency(price)}</span>
      {compareAtPrice && compareAtPrice > price && (
        <span className="text-obsidian/40 line-through text-[0.85em]">
          {formatCurrency(compareAtPrice)}
        </span>
      )}
    </span>
  );
}
