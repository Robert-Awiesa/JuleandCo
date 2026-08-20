"use client";

import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

interface VariantSelectorProps {
  product: Product;
  options: Record<string, string>;
  selections: Record<string, string>;
  onOptionChange: (name: string, value: string) => void;
  onSelectionChange: (key: string, value: string) => void;
  compact?: boolean;
}

/**
 * Renders one control per variant axis, plus any non-stocked selections.
 *
 * This used to hardcode a colour row, a lens row and a size row, with the
 * colour label switching on `category === "eyewear"`. Every axis now comes from
 * the product's own options, so a necklace's chain length or a ring's size
 * renders without a matching block being written here.
 */
export function VariantSelector({
  product,
  options,
  selections,
  onOptionChange,
  onSelectionChange,
  compact = false,
}: VariantSelectorProps) {
  const swatchOption = (values: Product["options"][number]["values"]) =>
    values.some((v) => v.hex);

  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      {product.options.map((option) => {
        const chosen = option.values.find((v) => v.value === options[option.name]);
        const asSwatches = swatchOption(option.values);

        return (
          <div key={option.name}>
            <p className="mb-3 text-xs uppercase tracking-widest2 text-obsidian/50">
              {option.name}
              {chosen ? ` — ${chosen.label}` : ""}
            </p>

            <div className="flex flex-wrap gap-2">
              {option.values.map((value) => {
                const active = options[option.name] === value.value;

                if (asSwatches) {
                  return (
                    <button
                      key={value.value}
                      onClick={() => onOptionChange(option.name, value.value)}
                      disabled={!value.inStock}
                      title={value.inStock ? value.label : `${value.label} — out of stock`}
                      aria-label={value.label}
                      className={cn(
                        "relative h-8 w-8 rounded-full border transition-transform",
                        active ? "border-obsidian ring-1 ring-obsidian ring-offset-2" : "border-obsidian/20",
                        !value.inStock && "cursor-not-allowed opacity-40"
                      )}
                      style={{ backgroundColor: value.hex || "#9CA3AF" }}
                    >
                      {!value.inStock && (
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white/90">
                          ×
                        </span>
                      )}
                    </button>
                  );
                }

                return (
                  <button
                    key={value.value}
                    onClick={() => onOptionChange(option.name, value.value)}
                    disabled={!value.inStock}
                    className={cn(
                      "border px-3.5 py-2 text-sm transition-colors",
                      active
                        ? "border-obsidian bg-obsidian text-alabaster"
                        : "border-obsidian/20 hover:border-obsidian",
                      !value.inStock && "cursor-not-allowed text-obsidian/30 line-through hover:border-obsidian/20"
                    )}
                  >
                    {value.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {product.selections.map((selection) => (
        <div key={selection.key}>
          <p className="mb-3 text-xs uppercase tracking-widest2 text-obsidian/50">
            {selection.label}
            {selections[selection.key]
              ? ` — ${selection.values.find((v) => v.value === selections[selection.key])?.label}`
              : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            {selection.values.map((value) => (
              <button
                key={value.value}
                onClick={() => onSelectionChange(selection.key, value.value)}
                className={cn(
                  "border px-3.5 py-2 text-sm transition-colors",
                  selections[selection.key] === value.value
                    ? "border-obsidian bg-obsidian text-alabaster"
                    : "border-obsidian/20 hover:border-obsidian"
                )}
              >
                {value.label}
              </button>
            ))}
          </div>
          {!compact && (
            <p className="mt-2 text-xs text-obsidian/45">
              Available on every option above — stock is held per {product.options[0]?.name.toLowerCase() ?? "item"}.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
