"use client";

import { useMemo, useState } from "react";
import type { Product } from "@/lib/types";

/**
 * Tracks which option values and non-stocked selections the customer has
 * chosen, and resolves them to a concrete variant.
 *
 * Both the product page and the quick-view modal need this, and both used to
 * hold `color`/`size` in their own useState pairs — which only worked while
 * every product varied by exactly those two things.
 */
export function useVariantSelection(product: Product) {
  const firstAvailable = (values: Product["options"][number]["values"]) =>
    (values.find((v) => v.inStock) ?? values[0])?.value;

  const [options, setOptions] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (product.options ?? [])
        .map((option) => [option.name, firstAvailable(option.values)])
        .filter(([, value]) => value !== undefined)
    )
  );

  const [selections, setSelections] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (product.selections ?? [])
        .map((selection) => [selection.key, selection.values[0]?.value])
        .filter(([, value]) => value !== undefined)
    )
  );

  const variant = useMemo(
    () =>
      (product.variants ?? []).find(
        (candidate) =>
          candidate.optionValues.length > 0 &&
          candidate.optionValues.every((ov) => options[ov.name] === ov.value)
      ),
    [product.variants, options]
  );

  /** Per-value image wins over the gallery, so picking a colourway swaps the shot. */
  const image = useMemo(() => {
    for (const option of product.options ?? []) {
      const chosen = option.values.find((v) => v.value === options[option.name]);
      if (chosen?.image) return chosen.image;
    }
    return product.images[0];
  }, [product.options, product.images, options]);

  /** Human-readable choices for the cart line, e.g. { Metal: "Rose Gold" }. */
  const optionLabels = useMemo(
    () =>
      Object.fromEntries(
        (product.options ?? [])
          .map((option) => {
            const chosen = option.values.find((v) => v.value === options[option.name]);
            return chosen ? [option.name, chosen.label] : null;
          })
          .filter(Boolean) as [string, string][]
      ),
    [product.options, options]
  );

  const selectionLabels = useMemo(
    () =>
      Object.fromEntries(
        (product.selections ?? [])
          .map((selection) => {
            const chosen = selection.values.find((v) => v.value === selections[selection.key]);
            return chosen ? [selection.label, chosen.label] : null;
          })
          .filter(Boolean) as [string, string][]
      ),
    [product.selections, selections]
  );

  // A product with no options at all is a single sellable item.
  const isAvailable =
    (product.options ?? []).length === 0 ? product.stock > 0 : Boolean(variant?.inStock);

  return {
    options,
    selections,
    setOption: (name: string, value: string) => setOptions((o) => ({ ...o, [name]: value })),
    setSelection: (key: string, value: string) => setSelections((s) => ({ ...s, [key]: value })),
    variant,
    image,
    optionLabels,
    selectionLabels,
    isAvailable,
  };
}
