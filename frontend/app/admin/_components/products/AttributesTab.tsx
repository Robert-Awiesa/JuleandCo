"use client";

import { useFormContext } from "react-hook-form";
import { useAttributes } from "../../_lib/useAttributes";
import type { AttributeGroup, ProductCategory } from "../../_lib/types";
import type { ProductFormInput } from "./schema";

const inputClass =
  "mt-1 w-full rounded border border-obsidian/15 px-3 py-2 text-sm outline-none focus:border-obsidian/40";
const labelClass = "text-xs uppercase tracking-widest2 text-obsidian/60";

/**
 * A dropdown backed by an admin-managed vocabulary. Free text here used to
 * fragment the storefront's filter facets ("Aviator" vs "aviator" became two
 * separate checkboxes), so every controlled attribute goes through this.
 */
function VocabularySelect({
  name,
  group,
  category,
  label,
  hint,
}: {
  name: "frameShape" | "frameMaterial" | "lensColor" | "fabric" | "fit" | "gender";
  group: AttributeGroup;
  category: ProductCategory;
  label: string;
  hint?: string;
}) {
  const { register } = useFormContext<ProductFormInput>();
  const { data: options = [], isLoading } = useAttributes(group, category);

  return (
    <div>
      <label htmlFor={`attr-${name}`} className={labelClass}>
        {label}
      </label>
      <select id={`attr-${name}`} {...register(name)} className={inputClass}>
        <option value="">{isLoading ? "Loading…" : "Not specified"}</option>
        {options.map((option) => (
          <option key={option._id} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && <p className="mt-1 text-xs text-obsidian/45">{hint}</p>}
      {!isLoading && options.length === 0 && (
        <p className="mt-1 text-xs text-gold-dark">
          No options defined yet — add them under Attributes in the sidebar.
        </p>
      )}
    </div>
  );
}

/** Multi-select chips for a vocabulary-backed array field. */
function VocabularyChips({
  name,
  group,
  category,
  label,
  hint,
}: {
  name: "lensOptions" | "clothingSize";
  group: AttributeGroup;
  category: ProductCategory;
  label: string;
  hint?: string;
}) {
  const { watch, setValue } = useFormContext<ProductFormInput>();
  const { data: options = [], isLoading } = useAttributes(group, category);
  const selected = watch(name) ?? [];

  function toggle(value: string) {
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    setValue(name, next, { shouldDirty: true });
  }

  return (
    <div>
      <span className={labelClass}>{label}</span>
      {hint && <p className="mt-1 text-xs text-obsidian/45">{hint}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {isLoading && <span className="text-sm text-obsidian/40">Loading…</span>}
        {options.map((option) => {
          const active = selected.includes(option.value);
          return (
            <button
              key={option._id}
              type="button"
              onClick={() => toggle(option.value)}
              className={
                active
                  ? "flex items-center gap-2 rounded border border-obsidian bg-obsidian px-3 py-1.5 text-sm text-alabaster"
                  : "flex items-center gap-2 rounded border border-obsidian/20 px-3 py-1.5 text-sm text-obsidian/70 hover:border-obsidian/50"
              }
            >
              {option.hex && (
                <span
                  className="h-3.5 w-3.5 rounded-full border border-white/40"
                  style={{ backgroundColor: option.hex }}
                />
              )}
              {option.label}
            </button>
          );
        })}
        {!isLoading && options.length === 0 && (
          <span className="text-xs text-gold-dark">
            No options defined yet — add them under Attributes in the sidebar.
          </span>
        )}
      </div>
    </div>
  );
}

export function AttributesTab() {
  const { register, watch } = useFormContext<ProductFormInput>();
  const category = watch("category") as ProductCategory;

  return (
    <div className="max-w-3xl space-y-8">
      {category === "eyewear" ? (
        <>
          <div className="grid grid-cols-2 gap-5">
            <VocabularySelect name="frameShape" group="frameShape" category={category} label="Frame shape" />
            <VocabularySelect
              name="frameMaterial"
              group="frameMaterial"
              category={category}
              label="Frame material"
            />
          </div>

          <VocabularySelect
            name="lensColor"
            group="lensType"
            category={category}
            label="Default lens"
            hint="The lens shown in the product's spec list."
          />

          <VocabularySelect name="gender" group="gender" category={category} label="Designed for" />

          <VocabularyChips
            name="lensOptions"
            group="lensType"
            category={category}
            label="Lens options offered"
            hint="Every lens this frame can be ordered with — shoppers pick one on the product page. Stock is tracked per frame colour, not per lens."
          />

          <div>
            <span className={labelClass}>Measurements (mm)</span>
            <p className="mt-1 text-xs text-obsidian/45">
              Written on the temple arm as lens–bridge–temple, e.g. 52–18–145.
            </p>
            <div className="mt-2 grid grid-cols-3 gap-4">
              <div>
                <label htmlFor="lens-width" className="text-xs text-obsidian/50">
                  Lens width
                </label>
                <input
                  id="lens-width"
                  type="number"
                  min={0}
                  {...register("measurements.lensWidthMm")}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="bridge-width" className="text-xs text-obsidian/50">
                  Bridge
                </label>
                <input
                  id="bridge-width"
                  type="number"
                  min={0}
                  {...register("measurements.bridgeWidthMm")}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="temple-length" className="text-xs text-obsidian/50">
                  Temple length
                </label>
                <input
                  id="temple-length"
                  type="number"
                  min={0}
                  {...register("measurements.templeLengthMm")}
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-5">
            <VocabularySelect name="fabric" group="fabric" category={category} label="Fabric" />
            <VocabularySelect name="fit" group="fit" category={category} label="Fit" />
          </div>

          <VocabularySelect name="gender" group="gender" category={category} label="Designed for" />

          <VocabularyChips
            name="clothingSize"
            group="clothingSize"
            category={category}
            label="Sizes offered"
            hint="Drives the Inventory grid — each size becomes a row per colour."
          />

          <div>
            <label htmlFor="composition" className={labelClass}>
              Composition
            </label>
            <input
              id="composition"
              {...register("composition")}
              placeholder="e.g. 80% Merino Wool, 20% Cashmere"
              className={inputClass}
            />
          </div>
        </>
      )}

      <div>
        <label htmlFor="care" className={labelClass}>
          Care instructions
        </label>
        <textarea
          id="care"
          rows={2}
          {...register("careInstructions")}
          placeholder={
            category === "eyewear"
              ? "e.g. Clean with the supplied microfibre cloth. Avoid alcohol-based cleaners."
              : "e.g. Dry clean only. Cool iron on reverse."
          }
          className={inputClass}
        />
      </div>
    </div>
  );
}
