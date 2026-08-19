"use client";

import { useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { buildVariantMatrix } from "./variantMatrix";
import type { ProductFormInput } from "./schema";

export function InventoryTab() {
  const { control, register, watch, setValue } = useFormContext<ProductFormInput>();
  const colors = useWatch({ control, name: "colors" });
  const clothingSize = useWatch({ control, name: "clothingSize" }) ?? [];
  const category = useWatch({ control, name: "category" });
  const variants = watch("variants");

  useEffect(() => {
    const validColors = colors.filter((c) => c.colorLabel.trim().length > 0);
    const sizes = category === "apparel" ? clothingSize : [];
    const next = buildVariantMatrix(validColors, sizes, variants);
    setValue("variants", next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(colors), JSON.stringify(clothingSize), category]);

  const total = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);

  function setAll(value: number) {
    variants.forEach((_, i) => setValue(`variants.${i}.stock`, value));
  }

  if (variants.length === 0) {
    return (
      <p className="max-w-3xl text-sm text-obsidian/50">
        Add at least one color on the Colors &amp; Images tab to build the inventory grid.
      </p>
    );
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-obsidian">
          Total stock: <span className="font-medium">{total}</span>
        </p>
        <div className="flex items-center gap-2 text-xs">
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

      <div className="overflow-hidden rounded-lg border border-obsidian/10">
        <table className="w-full text-sm">
          <thead className="border-b border-obsidian/10 bg-obsidian/[0.02] text-left text-xs uppercase tracking-wide text-obsidian/50">
            <tr>
              <th className="px-4 py-2">Color</th>
              {category === "apparel" && <th className="px-4 py-2">Size</th>}
              <th className="px-4 py-2">SKU</th>
              <th className="px-4 py-2">Stock</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-obsidian/10">
            {variants.map((variant, index) => (
              <tr key={variant.id}>
                <td className="px-4 py-2 text-obsidian">{variant.colorLabel}</td>
                {category === "apparel" && <td className="px-4 py-2 text-obsidian/70">{variant.sizeLabel}</td>}
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
