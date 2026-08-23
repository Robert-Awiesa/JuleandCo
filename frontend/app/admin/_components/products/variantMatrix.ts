import type { ProductOption, Variant } from "../../_lib/types";

/**
 * Mirrors backend/src/models/productStock.js so ids generated here match what
 * the server recomputes on save. Keep the two in step.
 */
export function deriveVariantId(optionValues: { name: string; value: string }[]) {
  const parts = optionValues.map((o) => o.value).filter(Boolean);
  return parts.length > 0 ? parts.join("--") : "default";
}

/**
 * Builds the full grid of sellable combinations from the product's options.
 *
 * Previously this took (colors, sizes) and the Inventory tab only ever supplied
 * sizes for apparel, so a second axis was unreachable for anything else. It now
 * takes any number of options and produces their cartesian product, which is
 * what lets a ring carry sizes and a necklace carry chain lengths.
 *
 * Stock and SKU already entered are preserved by variant id, so editing one
 * option does not wipe the numbers typed against the others.
 */
export function buildVariantMatrix(
  options: ProductOption[],
  existing: Array<{ id: string; stock?: unknown; sku?: string }> = []
): Variant[] {
  const existingById = new Map(existing.map((v) => [v.id, v]));

  // An option with no values yet would collapse the product to zero variants,
  // so it sits the grid out until it has one.
  const axes = options.filter((option) => (option.values || []).length > 0);

  const combinations = axes.reduce<{ name: string; value: string }[][]>(
    (rows, option) =>
      rows.flatMap((row) => option.values.map((value) => [...row, { name: option.name, value: value.value }])),
    [[]]
  );

  return combinations.map((optionValues) => {
    const id = deriveVariantId(optionValues);
    const prior = existingById.get(id);
    return {
      id,
      optionValues,
      // Stock arrives straight off a number input, so it is still a string
      // until Zod coerces it at submit time.
      stock: Number(prior?.stock ?? 0) || 0,
      sku: prior?.sku,
    };
  });
}

/** Human-readable description of a combination, e.g. "Rose Gold / 18 in". */
export function describeVariant(
  variant: { optionValues: { name: string; value: string }[] },
  options: ProductOption[]
) {
  return variant.optionValues
    .map((ov) => {
      const option = options.find((o) => o.name === ov.name);
      const match = option?.values.find((v) => v.value === ov.value);
      return match?.label || ov.value;
    })
    .join(" / ");
}
