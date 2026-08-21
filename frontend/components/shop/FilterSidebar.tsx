"use client";

import { useSearchParams } from "next/navigation";
import type { FacetOption, FacetResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

interface FilterSidebarProps {
  /** Options actually present in the published catalogue, already labelled by the API. */
  facets: FacetResponse;
  categories: { slug: string; name: string }[];
  onChange: (patch: Record<string, string | string[] | null>) => void;
  onReset: () => void;
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-line py-5">
      <p className="mb-3 text-xs uppercase tracking-widest2 text-ink-subtle">{title}</p>
      {children}
    </div>
  );
}

/**
 * Renders whatever facets the API advertises.
 *
 * This previously carried a hardcoded category list, a hardcoded reset patch, a
 * hardcoded active-filter counter and one JSX block per attribute group — so a
 * new filter was invisible until four separate edits were made here. The groups
 * and their control style now come from `facets.groupMeta`.
 */
export function FilterSidebar({ facets, categories, onChange, onReset }: FilterSidebarProps) {
  const searchParams = useSearchParams();

  const selected = (key: string): string[] => {
    const raw = searchParams.get(key);
    return raw ? raw.split(",").filter(Boolean) : [];
  };

  const toggle = (key: string, value: string) => {
    const current = selected(key);
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    onChange({ [key]: next.length > 0 ? next : null });
  };

  const category = searchParams.get("category") ?? "all";

  const facetKeys = [...facets.groupMeta.map((g) => g.key), "subCategory"];
  const activeCount = facetKeys.reduce((sum, key) => sum + selected(key).length, 0);

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
              active ? "border-gold bg-gold text-surface" : "border-line-strong hover:border-ink"
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

  return (
    <div>
      <div className="flex items-center justify-between pb-2">
        <p className="text-sm font-medium">Filter</p>
        {activeCount > 0 && (
          <button onClick={onReset} className="text-xs text-ink-subtle underline underline-offset-4">
            Clear ({activeCount})
          </button>
        )}
      </div>

      <FilterSection title="Category">
        <div className="space-y-2">
          {[{ slug: "all", name: "All" }, ...categories].map((option) => (
            <label key={option.slug} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="category"
                checked={category === option.slug}
                // Category-specific facets are dropped wholesale on a switch,
                // so no filter from the previous category is left dangling.
                onChange={() =>
                  onChange({
                    category: option.slug === "all" ? null : option.slug,
                    subCategory: null,
                    ...Object.fromEntries(facets.groupMeta.map((g) => [g.key, null])),
                  })
                }
                className="accent-obsidian"
              />
              {option.name}
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

      {[...facets.groupMeta]
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        .map((meta) => {
          const options = facets.groups[meta.key] ?? [];
          if (options.length === 0) return null;
          return (
            <FilterSection key={meta.key} title={meta.label}>
              {meta.filterStyle === "checkbox"
                ? checkboxes(meta.key, options)
                : chips(meta.key, options)}
            </FilterSection>
          );
        })}

      <FilterSection title="Price">
        <p className="text-sm text-ink-muted">
          GH₵{facets.priceBounds[0].toLocaleString()} – GH₵{facets.priceBounds[1].toLocaleString()}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <input
            type="number"
            placeholder="Min"
            defaultValue={searchParams.get("minPrice") ?? ""}
            onBlur={(e) => onChange({ minPrice: e.target.value || null })}
            className="w-full border border-line-strong px-2 py-1.5 text-sm focus:border-gold focus:outline-none"
          />
          <span className="text-ink-subtle">–</span>
          <input
            type="number"
            placeholder="Max"
            defaultValue={searchParams.get("maxPrice") ?? ""}
            onBlur={(e) => onChange({ maxPrice: e.target.value || null })}
            className="w-full border border-line-strong px-2 py-1.5 text-sm focus:border-gold focus:outline-none"
          />
        </div>
      </FilterSection>
    </div>
  );
}
