import { z } from "zod";

export const variantSchema = z.object({
  id: z.string(),
  colorId: z.string(),
  colorLabel: z.string(),
  colorHex: z.string().optional(),
  colorImage: z.string().optional(),
  sizeId: z.string().optional(),
  sizeLabel: z.string().optional(),
  stock: z.coerce.number().min(0),
  sku: z.string().optional(),
});

export const colorSchema = z.object({
  colorId: z.string().min(1),
  colorLabel: z.string().min(1, "Color name is required"),
  colorHex: z.string().optional(),
  colorImage: z.string().optional(),
});

// An emptied number input hands back "", which z.coerce.number() turns into 0 —
// and 0 fails .positive(), so a blank optional price would block the whole save
// with no visible field error. Normalize blank/NaN to undefined first.
const optionalPositiveNumber = z.preprocess(
  (value) => (value === "" || value === null || Number.isNaN(value) ? undefined : value),
  z.coerce.number().positive().optional()
);

export const productFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
  category: z.enum(["eyewear", "apparel"]),
  subCategory: z.string().min(1, "Sub-category is required"),
  description: z.string().min(1, "Description is required"),
  price: z.coerce.number().positive("Price must be greater than 0"),
  compareAtPrice: optionalPositiveNumber,
  images: z.array(z.string()).min(1, "At least one image is required"),
  // --- Eyewear ---
  frameShape: z.string().optional(),
  frameMaterial: z.string().optional(),
  lensColor: z.string().optional(),
  lensOptions: z.array(z.string()).optional(),
  measurements: z
    .object({
      lensWidthMm: optionalPositiveNumber,
      bridgeWidthMm: optionalPositiveNumber,
      templeLengthMm: optionalPositiveNumber,
    })
    .optional(),

  // --- Apparel ---
  fabric: z.string().optional(),
  clothingSize: z.array(z.string()).optional(),
  composition: z.string().optional(),
  fit: z.string().optional(),

  // --- Shared ---
  gender: z.string().optional(),
  careInstructions: z.string().optional(),

  isNewArrival: z.boolean().optional(),
  isBestSeller: z.boolean().optional(),
  tags: z.array(z.string()).optional(),

  // Draft keeps a product off the storefront entirely.
  publishStatus: z.enum(["draft", "published"]).default("draft"),
  costPrice: optionalPositiveNumber,
  barcode: z.string().optional(),
  weightGrams: optionalPositiveNumber,
  seo: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
    })
    .optional(),
  colors: z.array(colorSchema).min(1, "Add at least one color"),
  variants: z.array(variantSchema),
  pairsWith: z.array(z.string()).optional(),
});

// z.coerce/z.preprocess make the schema's input and output types differ: a number
// field holds a string while the user types and is a number only after parsing.
// React Hook Form needs both — Input for the registered fields and defaultValues,
// Values for what handleSubmit hands to the save mutation.
export type ProductFormInput = z.input<typeof productFormSchema>;
export type ProductFormValues = z.output<typeof productFormSchema>;
