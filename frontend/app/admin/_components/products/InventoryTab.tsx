"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { fillMissingSkus } from "./sku";
import type { ProductOption } from "../../_lib/types";
import type { ProductFormInput } from "./schema";

/**
 * The stock grid, one row per combination of option values.
 *
 * The axes used to come from `category === "apparel" ? clothingSize : []`, so
 * a second axis was unreachable for anything that was not clothing — a ring
 * with sizes could not be expressed at all. Columns are now derived from
 * whatever options the product defines.
 */
export function InventoryTab() {
  const { control, register, watch, setValue } = useFormContext<ProductFormInput>();
  const options = (useWatch({ control, name: "options" }) ?? []) as ProductOption[];
  const variants = watch("variants") ?? [];

  // The grid is rebuilt by ProductForm whenever the axes change, so it stays in
  // step even when this tab has never been opened. It used to happen here, and
  // a product saved without visiting Inventory kept whatever variants it had
  // before the axes were edited.

  const axes = options.filter((option) => (option.values || []).length > 0);
  const total = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
  const missingSkus = variants.filter((v) => !v.sku?.trim()).length;

  function setAll(value: number) {
    variants.forEach((_, i) => setValue(`variants.${i}.stock`, value, { shouldDirty: true }));
  }

  /** Fills the blanks only — a code typed by hand is never overwritten. */
  function generateSkus() {
    const { variants: next } = fillMissingSkus(variants, {
      productSlug: watch("slug") || "",
      subCategory: watch("subCategory") || "",
      options,
    });
    next.forEach((variant, i) => {
      if (variant.sku !== variants[i]?.sku) {
        setValue(`variants.${i}.sku`, variant.sku, { shouldDirty: true });
      }
    });
  }

  function valueLabel(optionName: string, value: string) {
    const option = axes.find((o) => o.name === optionName);
    return option?.values.find((v) => v.value === value)?.label || value;
  }

  if (variants.length === 0) {
    return (
      <p className="max-w-3xl text-sm text-obsidian/50">
        Add at least one option value on the Options &amp; Images tab to build the inventory grid.
      </p>
    );
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-obsidian">
          Total stock: <span className="font-medium">{total}</span>
          <span className="ml-2 text-obsidian/45">
            ({variants.length} {variants.length === 1 ? "combination" : "combinations"})
          </span>
        </p>
        <div className="flex items-center gap-3 text-xs">
          {missingSkus > 0 && (
            <button
              type="button"
              onClick={generateSkus}
              className="rounded border border-obsidian/25 px-3 py-1.5 uppercase tracking-wide text-obsidian/70 hover:border-obsidian/50 hover:text-obsidian"
            >
              Generate {missingSkus} SKU{missingSkus === 1 ? "" : "s"}
            </button>
          )}
          <span className="text-obsidian/50">Set all to</span>
          <input
            type="number"
            min={0}
            className="w-16 rounded border border-obsidian/15 px-2 py-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                setAll(Number((e.target as HTMLInputElement).value) || 0);
              }
            }}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-obsidian/10">
        <table className="w-full text-sm">
          <thead className="border-b border-obsidian/10 bg-obsidian/[0.02] text-left text-xs uppercase tracking-wide text-obsidian/50">
            <tr>
              {axes.map((option) => (
                <th key={option.name} className="px-4 py-2">
                  {option.name}
                </th>
              ))}
              {axes.length === 0 && <th className="px-4 py-2">Item</th>}
              <th className="px-4 py-2">SKU</th>
              <th className="px-4 py-2">Stock</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-obsidian/10">
            {variants.map((variant, index) => (
              <tr key={variant.id}>
                {axes.map((option) => {
                  const chosen = variant.optionValues.find((ov) => ov.name === option.name);
                  return (
                    <td key={option.name} className="px-4 py-2 text-obsidian">
                      {chosen ? valueLabel(option.name, chosen.value) : "—"}
                    </td>
                  );
                })}
                {axes.length === 0 && <td className="px-4 py-2 text-obsidian/70">Single item</td>}

                <td className="px-4 py-2">
                  <input
                    {...register(`variants.${index}.sku`)}
                    placeholder={variant.id}
                    className="w-40 rounded border border-obsidian/15 px-2 py-1 font-mono text-xs"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    min={0}
                    {...register(`variants.${index}.stock`)}
                    className="w-20 rounded border border-obsidian/15 px-2 py-1 text-sm"
                  />
                </td>
                <td className="px-4 py-2">
                  {Number(variant.stock) > 0 ? (
                    <span className="text-green-700">In stock</span>
                  ) : (
                    <span className="text-red-600">Out of stock</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
