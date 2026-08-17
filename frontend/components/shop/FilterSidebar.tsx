"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { FilterState, ProductCategory } from "@/lib/types";
import { fabrics, frameShapes, lensColors, clothingSizes, priceBounds } from "@/lib/mockData";
import { cn, formatCurrency } from "@/lib/utils";

interface FilterSidebarProps {
  filters: FilterState;
  onChange: (patch: Partial<FilterState>) => void;
  onReset: () => void;
}

function FilterSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-obsidian/10 py-5">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-xs uppercase tracking-widest2 text-obsidian/60">{title}</span>
        <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="mt-4">{children}</div>}
    </div>
  );
}

function toggleValue(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function FilterSidebar({ filters, onChange, onReset }: FilterSidebarProps) {
  const categories: { label: string; value: ProductCategory | "all" }[] = [
    { label: "All", value: "all" },
    { label: "Eyewear", value: "eyewear" },
    { label: "Apparel", value: "apparel" },
  ];

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium">Filters</p>
        <button onClick={onReset} className="text-xs text-obsidian/50 underline-offset-4 hover:underline">
          Clear all
        </button>
      </div>

      <FilterSection title="Category">
        <div className="flex flex-col gap-2">
          {categories.map((c) => (
            <label key={c.value} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="category"
                checked={filters.category === c.value}
                onChange={() => onChange({ category: c.value })}
                className="accent-obsidian"
              />
              {c.label}
            </label>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Frame Shape">
        <div className="flex flex-wrap gap-2">
          {frameShapes.map((shape) => (
            <button
              key={shape}
              onClick={() => onChange({ frameShapes: toggleValue(filters.frameShapes, shape) })}
              className={cn(
                "border px-3 py-1.5 text-xs",
                filters.frameShapes.includes(shape)
                  ? "border-obsidian bg-obsidian text-alabaster"
                  : "border-obsidian/20 hover:border-obsidian"
              )}
            >
              {shape}
            </button>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Lens Color">
        <div className="flex flex-wrap gap-2">
          {lensColors.map((lc) => (
            <button
              key={lc}
              onClick={() => onChange({ lensColors: toggleValue(filters.lensColors, lc) })}
              className={cn(
                "border px-3 py-1.5 text-xs",
                filters.lensColors.includes(lc)
                  ? "border-obsidian bg-obsidian text-alabaster"
                  : "border-obsidian/20 hover:border-obsidian"
              )}
            >
              {lc}
            </button>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Clothing Size">
        <div className="flex flex-wrap gap-2">
          {clothingSizes.map((size) => (
            <button
              key={size}
              onClick={() => onChange({ sizes: toggleValue(filters.sizes, size) })}
              className={cn(
                "h-8 w-10 border text-xs",
                filters.sizes.includes(size)
                  ? "border-obsidian bg-obsidian text-alabaster"
                  : "border-obsidian/20 hover:border-obsidian"
              )}
            >
              {size}
            </button>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Fabric">
        <div className="flex flex-col gap-2">
          {fabrics.map((fabric) => (
            <label key={fabric} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filters.fabrics.some((f) => fabric.toLowerCase().includes(f.toLowerCase()))}
                onChange={() => onChange({ fabrics: toggleValue(filters.fabrics, fabric) })}
                className="accent-obsidian"
              />
              {fabric}
            </label>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Price Range">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-obsidian/60">
            <span>{formatCurrency(filters.priceRange[0])}</span>
            <span>{formatCurrency(filters.priceRange[1])}</span>
          </div>
          <input
            type="range"
            min={priceBounds[0]}
            max={priceBounds[1]}
            value={filters.priceRange[1]}
            onChange={(e) =>
              onChange({ priceRange: [filters.priceRange[0], Number(e.target.value)] })
            }
            className="w-full accent-obsidian"
          />
        </div>
      </FilterSection>
    </div>
  );
}
