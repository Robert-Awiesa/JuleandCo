"use client";

import { useFieldArray, useFormContext } from "react-hook-form";
import { HexColorPicker } from "react-colorful";
import { useState } from "react";
import { X } from "lucide-react";
import { ImageUploader } from "./ImageUploader";
import { resolveColorHex, UNRESOLVED_COLOR } from "./colorNames";
import type { ProductCategory } from "../../_lib/types";
import type { ProductFormInput } from "./schema";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function ColorsImagesTab() {
  const { register, control, watch, setValue, formState } = useFormContext<ProductFormInput>();
  const { fields, append, remove } = useFieldArray({ control, name: "colors" });
  const images = watch("images");
  const category = watch("category") as ProductCategory;
  const [openPicker, setOpenPicker] = useState<number | null>(null);
  // Once a hex is chosen by hand, typing in the name field must stop overwriting it.
  const [manualHex, setManualHex] = useState<Record<number, boolean>>({});

  const isEyewear = category === "eyewear";

  function handleNameChange(index: number, value: string) {
    setValue(`colors.${index}.colorId`, slugify(value), { shouldDirty: true });
    if (manualHex[index]) return;
    const hex = resolveColorHex(value);
    if (hex) setValue(`colors.${index}.colorHex`, hex, { shouldDirty: true });
  }

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
          <span className="text-xs uppercase tracking-widest2 text-obsidian/60">
            {isEyewear ? "Frame colours" : "Colours"}
          </span>
          <button
            type="button"
            onClick={() => {
              append({ colorId: `color-${Date.now()}`, colorLabel: "", colorHex: UNRESOLVED_COLOR });
              setOpenPicker(null);
            }}
            className="text-xs uppercase tracking-wide text-obsidian/70 hover:text-obsidian"
          >
            + Add colour
          </button>
        </div>

        <p className="mt-1 text-xs text-obsidian/45">
          {isEyewear
            ? "The frame/body colour — this is what the swatches on the product page select, and what stock is counted against. Lens options live on the Attributes tab."
            : "Each colour becomes a swatch on the product page and a row in the Inventory grid."}
        </p>

        <div className="mt-3 space-y-4">
          {fields.map((field, index) => {
            const hex = watch(`colors.${index}.colorHex`) || UNRESOLVED_COLOR;
            const name = watch(`colors.${index}.colorLabel`) || "";
            const unresolved = Boolean(name.trim()) && !manualHex[index] && !resolveColorHex(name);

            return (
              <div key={field.id} className="flex items-start gap-4 rounded border border-obsidian/10 p-4">
                <button
                  type="button"
                  onClick={() => setOpenPicker(openPicker === index ? null : index)}
                  title="Set this colour precisely"
                  className="mt-1 h-8 w-8 shrink-0 rounded-full border border-obsidian/20"
                  style={{ backgroundColor: hex }}
                />
                <div className="flex-1 space-y-3">
                  <input
                    {...register(`colors.${index}.colorLabel`, {
                      onChange: (e) => handleNameChange(index, e.target.value),
                    })}
                    placeholder={isEyewear ? "Frame colour, e.g. Tortoise" : "Colour name, e.g. Camel"}
                    className="w-full rounded border border-obsidian/15 px-3 py-2 text-sm outline-none focus:border-obsidian/40"
                  />

                  {unresolved && (
                    <p className="text-xs text-gold-dark">
                      No colour matched “{name}” — click the circle to set it by hand, or customers
                      will see grey.
                    </p>
                  )}

                  {openPicker === index && (
                    <div className="space-y-2">
                      <HexColorPicker
                        color={hex}
                        onChange={(next) => {
                          setManualHex((m) => ({ ...m, [index]: true }));
                          setValue(`colors.${index}.colorHex`, next, { shouldDirty: true });
                        }}
                      />
                      <p className="font-mono text-xs text-obsidian/50">{hex}</p>
                    </div>
                  )}

                  <ImageUploader
                    images={watch(`colors.${index}.colorImage`) ? [watch(`colors.${index}.colorImage`)!] : []}
                    onChange={(next) => setValue(`colors.${index}.colorImage`, next[0], { shouldDirty: true })}
                    multiple={false}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label="Remove colour"
                  className="text-obsidian/40 hover:text-red-600"
                >
                  <X size={16} />
                </button>
              </div>
            );
          })}
        </div>

        {formState.errors.colors && (
          <p className="mt-2 text-xs text-red-600">{formState.errors.colors.message as string}</p>
        )}
      </div>
    </div>
  );
}
