"use client";

import { useSearchParams } from "next/navigation";
import type { FacetOption, FacetResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

interface FilterSidebarProps {
  /** Options actually present in the published catalogue, already labelled by the API. */
  facets: FacetResponse;
  onChange: (patch: Record<string, string | string[] | null>) => void;
  onReset: () => void;
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-obsidian/10 py-5">
      <p className="mb-3 text-xs uppercase tracking-widest2 text-obsidian/50">{title}</p>
      {children}
    </div>
  );
}

export function FilterSidebar({ facets, onChange, onReset }: FilterSidebarProps) {
  const searchParams = useSearchParams();

  const selected = (key: string): string[] => {
    const raw = searchParams.get(key);
    return raw ? raw.split(",").filter(Boolean) : [];
  };

  const toggle = (key: string, value: string) => {
    const current = selected(key);
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onChange({ [key]: next.length > 0 ? next : null });
  };

  const category = searchParams.get("category") ?? "all";
  const activeCount = [
    "frameShape",
    "frameMaterial",
    "lensType",
    "gender",
    "fit",
    "fabric",
    "size",
    "subCategory",
  ].reduce((sum, key) => sum + selected(key).length, 0);

  /** Chip group — used for anything with a short label, plus a swatch when the option has one. */
  const chips = (key: string, options: FacetOption[]) => (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = selected(key).includes(option.value);
        return (
          <button
            key={option.value}
            onClick={() => toggle(key, option.value)}
            className={cn(
              "flex items-center gap-1.5 border px-3 py-1.5 text-sm transition-colors",
              active
                ? "border-obsidian bg-obsidian text-alabaster"
                : "border-obsidian/20 hover:border-obsidian"
            )}
          >
            {option.hex && (
              <span
                className="h-3 w-3 rounded-full border border-current/20"
                style={{ backgroundColor: option.hex }}
              />
            )}
            {option.label}
          </button>
        );
      })}
    </div>
  );

  const checkboxes = (key: string, options: FacetOption[]) => (
    <div className="space-y-2">
      {options.map((option) => (
        <label key={option.value} className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={selected(key).includes(option.value)}
            onChange={() => toggle(key, option.value)}
            className="accent-obsidian"
          />
          {option.label}
        </label>
      ))}
    </div>
  );

  const { groups } = facets;

  return (
    <div>
      <div className="flex items-center justify-between pb-2">
        <p className="text-sm font-medium">Filter</p>
        {activeCount > 0 && (
          <button onClick={onReset} className="text-xs text-obsidian/50 underline underline-offset-4">
            Clear ({activeCount})
          </button>
        )}
      </div>

      <FilterSection title="Category">
        <div className="space-y-2">
          {[
            { label: "All", value: "all" },
            { label: "Eyewear", value: "eyewear" },
            { label: "Apparel", value: "apparel" },
          ].map((c) => (
            <label key={c.value} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="category"
                checked={category === c.value}
                // Changing category invalidates every category-specific facet,
                // so those params are dropped rather than left dangling.
                onChange={() =>
                  onChange({
                    category: c.value === "all" ? null : c.value,
                    frameShape: null,
                    frameMaterial: null,
                    lensType: null,
                    fabric: null,
                    fit: null,
                    size: null,
                    subCategory: null,
                  })
                }
                className="accent-obsidian"
              />
              {c.label}
            </label>
          ))}
        </div>
      </FilterSection>

      {facets.subCategories.length > 0 && (
        <FilterSection title="Type">
          {checkboxes(
            "subCategory",
            facets.subCategories.map((value) => ({
              value,
              label: value.charAt(0).toUpperCase() + value.slice(1),
            }))
          )}
        </FilterSection>
      )}

      {groups.frameShape.length > 0 && (
        <FilterSection title="Frame Shape">{chips("frameShape", groups.frameShape)}</FilterSection>
      )}

      {groups.frameMaterial.length > 0 && (
        <FilterSection title="Frame Material">
          {checkboxes("frameMaterial", groups.frameMaterial)}
        </FilterSection>
      )}

      {groups.lensType.length > 0 && (
        <FilterSection title="Lens">{chips("lensType", groups.lensType)}</FilterSection>
      )}

      {groups.clothingSize.length > 0 && (
        <FilterSection title="Size">{chips("size", groups.clothingSize)}</FilterSection>
      )}

      {groups.fabric.length > 0 && (
        <FilterSection title="Fabric">{checkboxes("fabric", groups.fabric)}</FilterSection>
      )}

      {groups.fit.length > 0 && <FilterSection title="Fit">{chips("fit", groups.fit)}</FilterSection>}

      {groups.gender.length > 0 && (
        <FilterSection title="Designed For">{chips("gender", groups.gender)}</FilterSection>
      )}

      <FilterSection title="Price">
        <p className="text-sm text-obsidian/60">
          GH₵{facets.priceBounds[0].toLocaleString()} – GH₵{facets.priceBounds[1].toLocaleString()}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <input
            type="number"
            placeholder="Min"
            defaultValue={searchParams.get("minPrice") ?? ""}
            onBlur={(e) => onChange({ minPrice: e.target.value || null })}
            className="w-full border border-obsidian/20 px-2 py-1.5 text-sm focus:border-obsidian focus:outline-none"
          />
          <span className="text-obsidian/40">–</span>
          <input
            type="number"
            placeholder="Max"
            defaultValue={searchParams.get("maxPrice") ?? ""}
            onBlur={(e) => onChange({ maxPrice: e.target.value || null })}
            className="w-full border border-obsidian/20 px-2 py-1.5 text-sm focus:border-obsidian focus:outline-none"
          />
        </div>
      </FilterSection>
    </div>
  );
}
