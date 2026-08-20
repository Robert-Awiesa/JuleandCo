"use client";

import { useEffect } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { HexColorPicker } from "react-colorful";
import { useState } from "react";
import { X } from "lucide-react";
import { ImageUploader } from "./ImageUploader";
import { resolveColorHex, UNRESOLVED_COLOR } from "./colorNames";
import { useAttributes, useCategories } from "../../_lib/useCatalogConfig";
import type { AttributeGroup } from "../../_lib/types";
import type { ProductFormInput } from "./schema";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/**
 * Values for an axis backed by a vocabulary — metal, chain length, ring size.
 * The admin picks which of the vocabulary's options this product offers.
 */
function VocabularyValues({ optionIndex, groupKey }: { optionIndex: number; groupKey: string }) {
  const { watch, setValue } = useFormContext<ProductFormInput>();
  const { data: available = [], isLoading } = useAttributes(groupKey);
  const values = watch(`options.${optionIndex}.values`) ?? [];

  function toggle(option: { value: string; label: string; hex?: string }) {
    const exists = values.some((v) => v.value === option.value);
    const next = exists
      ? values.filter((v) => v.value !== option.value)
      : [...values, { value: option.value, label: option.label, hex: option.hex }];
    setValue(`options.${optionIndex}.values`, next, { shouldDirty: true });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {isLoading && <span className="text-sm text-obsidian/40">Loading…</span>}
      {available.map((option) => {
        const active = values.some((v) => v.value === option.value);
        return (
          <button
            key={option._id}
            type="button"
            onClick={() => toggle(option)}
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
      {!isLoading && available.length === 0 && (
        <span className="text-xs text-gold-dark">
          No options defined for this vocabulary — add them under Attributes.
        </span>
      )}
    </div>
  );
}

/**
 * Values for a free-form axis, typically the colourway. Each carries a swatch
 * and optionally its own product shot.
 */
function FreeformValues({ optionIndex }: { optionIndex: number }) {
  const { register, watch, setValue } = useFormContext<ProductFormInput>();
  const values = watch(`options.${optionIndex}.values`) ?? [];
  const [openPicker, setOpenPicker] = useState<number | null>(null);
  // Once a hex is chosen by hand, typing in the name must stop overwriting it.
  const [manualHex, setManualHex] = useState<Record<number, boolean>>({});

  function addValue() {
    setValue(
      `options.${optionIndex}.values`,
      [...values, { value: `value-${Date.now()}`, label: "", hex: UNRESOLVED_COLOR }],
      { shouldDirty: true }
    );
  }

  function removeValue(index: number) {
    setValue(
      `options.${optionIndex}.values`,
      values.filter((_, i) => i !== index),
      { shouldDirty: true }
    );
  }

  function handleNameChange(index: number, label: string) {
    setValue(`options.${optionIndex}.values.${index}.value`, slugify(label), { shouldDirty: true });
    if (manualHex[index]) return;
    const hex = resolveColorHex(label);
    if (hex) setValue(`options.${optionIndex}.values.${index}.hex`, hex, { shouldDirty: true });
  }

  return (
    <div className="space-y-4">
      {values.map((value, index) => {
        const hex = watch(`options.${optionIndex}.values.${index}.hex`) || UNRESOLVED_COLOR;
        const label = watch(`options.${optionIndex}.values.${index}.label`) || "";
        const unresolved = Boolean(label.trim()) && !manualHex[index] && !resolveColorHex(label);

        return (
          <div key={index} className="flex items-start gap-4 rounded border border-obsidian/10 p-4">
            <button
              type="button"
              onClick={() => setOpenPicker(openPicker === index ? null : index)}
              title="Set this colour precisely"
              className="mt-1 h-8 w-8 shrink-0 rounded-full border border-obsidian/20"
              style={{ backgroundColor: hex }}
            />
            <div className="flex-1 space-y-3">
              <input
                {...register(`options.${optionIndex}.values.${index}.label`, {
                  onChange: (e) => handleNameChange(index, e.target.value),
                })}
                placeholder="e.g. Tortoise"
                className="w-full rounded border border-obsidian/15 px-3 py-2 text-sm outline-none focus:border-obsidian/40"
              />

              {unresolved && (
                <p className="text-xs text-gold-dark">
                  No colour matched “{label}” — click the circle to set it by hand, or customers
                  will see grey.
                </p>
              )}

              {openPicker === index && (
                <div className="space-y-2">
                  <HexColorPicker
                    color={hex}
                    onChange={(next) => {
                      setManualHex((m) => ({ ...m, [index]: true }));
                      setValue(`options.${optionIndex}.values.${index}.hex`, next, {
                        shouldDirty: true,
                      });
                    }}
                  />
                  <p className="font-mono text-xs text-obsidian/50">{hex}</p>
                </div>
              )}

              <ImageUploader
                images={value.image ? [value.image] : []}
                onChange={(next) =>
                  setValue(`options.${optionIndex}.values.${index}.image`, next[0], {
                    shouldDirty: true,
                  })
                }
                multiple={false}
              />
            </div>
            <button
              type="button"
              onClick={() => removeValue(index)}
              aria-label="Remove value"
              className="text-obsidian/40 hover:text-red-600"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}

      <button
        type="button"
        onClick={addValue}
        className="text-xs uppercase tracking-wide text-obsidian/70 hover:text-obsidian"
      >
        + Add value
      </button>
    </div>
  );
}

export function OptionsImagesTab() {
  const { control, watch, setValue, formState } = useFormContext<ProductFormInput>();
  const { fields, append, remove } = useFieldArray({ control, name: "options" });
  const images = watch("images");
  const category = watch("category");
  const options = watch("options") ?? [];

  const { data: categories = [] } = useCategories();
  const categoryConfig = categories.find((c) => c.slug === category);

  /**
   * Seed the axes from the category's defaults the first time. A jewellery
   * product starts with Metal and Length, an eyewear one with Frame Colour —
   * without anyone hardcoding either.
   */
  useEffect(() => {
    if (!categoryConfig || options.length > 0) return;
    const defaults = categoryConfig.optionDefaults || [];
    if (defaults.length === 0) return;

    setValue(
      "options",
      defaults.map((d) => ({ name: d.label, groupKey: d.groupKey, values: [] })),
      { shouldDirty: false }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryConfig?.slug]);

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <span className="text-xs uppercase tracking-widest2 text-obsidian/60">Product gallery</span>
        <div className="mt-2">
          <ImageUploader images={images} onChange={(next) => setValue("images", next, { shouldDirty: true })} />
        </div>
        {formState.errors.images && <p className="mt-1 text-xs text-red-600">{formState.errors.images.message}</p>}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-widest2 text-obsidian/60">Options</span>
          <button
            type="button"
            onClick={() => append({ name: "", groupKey: undefined, values: [] })}
            className="text-xs uppercase tracking-wide text-obsidian/70 hover:text-obsidian"
          >
            + Add option
          </button>
        </div>
        <p className="mt-1 text-xs text-obsidian/45">
          Each option is a way this product varies. Every combination becomes a stocked row on the
          Inventory tab. A product with no options is sold as a single item.
        </p>

        <div className="mt-4 space-y-6">
          {fields.map((field, index) => {
            const groupKey = watch(`options.${index}.groupKey`);
            return (
              <div key={field.id} className="rounded-lg border border-obsidian/15 p-4">
                <div className="flex items-center gap-3">
                  <input
                    {...control.register(`options.${index}.name`)}
                    placeholder="Option name, e.g. Metal"
                    className="flex-1 rounded border border-obsidian/15 px-3 py-2 text-sm font-medium outline-none focus:border-obsidian/40"
                  />
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    aria-label="Remove option"
                    className="text-obsidian/40 hover:text-red-600"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="mt-4">
                  {groupKey ? (
                    <VocabularyValues optionIndex={index} groupKey={groupKey} />
                  ) : (
                    <FreeformValues optionIndex={index} />
                  )}
                </div>
              </div>
            );
          })}

          {fields.length === 0 && (
            <p className="text-sm text-obsidian/50">
              No options — this product will be sold as a single item with one stock figure.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
