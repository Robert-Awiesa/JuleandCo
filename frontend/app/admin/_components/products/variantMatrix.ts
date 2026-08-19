import type { Variant } from "../../_lib/types";

export interface ColorInput {
  colorId: string;
  colorLabel: string;
  colorHex?: string;
  colorImage?: string;
}

// Mirrors backend/src/models/productStock.js so ids generated here match what
// the server recomputes on save. Keep the two in step.
export function deriveVariantId(colorId: string, sizeId?: string) {
  return sizeId ? `${colorId}--${sizeId}` : colorId;
}

export function buildVariantMatrix(
  colors: ColorInput[],
  sizes: string[],
  // Stock arrives straight off a number input, so it is still a string (or
  // undefined for a brand-new row) until Zod coerces it at submit time.
  existing: Array<{ id: string; stock?: unknown; sku?: string }>
): Variant[] {
  const existingById = new Map(existing.map((v) => [v.id, v]));
  const rows: Variant[] = [];

  colors.forEach((color) => {
    const sizeList: Array<string | undefined> = sizes.length > 0 ? sizes : [undefined];
    sizeList.forEach((sizeLabel) => {
      const sizeId = sizeLabel ? sizeLabel.toLowerCase() : undefined;
      const id = deriveVariantId(color.colorId, sizeId);
      const prior = existingById.get(id);
      rows.push({
        id,
        colorId: color.colorId,
        colorLabel: color.colorLabel,
        colorHex: color.colorHex,
        colorImage: color.colorImage,
        sizeId,
        sizeLabel,
        stock: Number(prior?.stock ?? 0) || 0,
        // Preserved across rebuilds — renaming a colour must not wipe SKUs.
        sku: prior?.sku,
      });
    });
  });

  return rows;
}
