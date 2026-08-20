import { z } from "zod";

// An emptied number input hands back "", which z.coerce.number() turns into 0 —
// and 0 fails .positive(), so a blank optional price would block the whole save
// with no visible field error. Normalize blank/NaN to undefined first.
const optionalPositiveNumber = z.preprocess(
  (value) => (value === "" || value === null || Number.isNaN(value) ? undefined : value),
  z.coerce.number().positive().optional()
);

export const optionValueSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1, "Every option value needs a name"),
  hex: z.string().optional(),
  image: z.string().optional(),
});

/** A variant axis: "Frame Colour", "Metal", "Length". */
export const productOptionSchema = z.object({
  name: z.string().min(1, "Give this option a name"),
  groupKey: z.string().optional(),
  values: z.array(optionValueSchema),
});

export const variantSchema = z.object({
  id: z.string(),
  optionValues: z.array(z.object({ name: z.string(), value: z.string() })),
  stock: z.coerce.number().min(0),
  sku: z.string().optional(),
});

export const productFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),

  // A category slug, validated against the Category collection by the API.
  // Not a z.enum: categories are data now, so a union here would reintroduce
  // the very hardcoding this refactor removed.
  category: z.string().min(1, "Category is required"),
  subCategory: z.string().min(1, "Sub-category is required"),

  description: z.string().min(1, "Description is required"),
  price: z.coerce.number().positive("Price must be greater than 0"),
  compareAtPrice: optionalPositiveNumber,
  images: z.array(z.string()).min(1, "At least one image is required"),

  /**
   * Category-specific values keyed by AttributeGroup.key. Untyped on purpose —
   * which keys are valid depends on the category's groups, which are data. The
   * form renders only the groups bound to the chosen category, and the API is
   * the authority on what a group accepts.
   */
  attributes: z.record(z.string(), z.any()).default({}),

  options: z.array(productOptionSchema).default([]),
  variants: z.array(variantSchema).default([]),

  isNewArrival: z.boolean().optional(),
  isBestSeller: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  pairsWith: z.array(z.string()).optional(),

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
});

// z.coerce/z.preprocess make the schema's input and output types differ: a number
// field holds a string while the user types and is a number only after parsing.
// React Hook Form needs both — Input for the registered fields and defaultValues,
// Values for what handleSubmit hands to the save mutation.
export type ProductFormInput = z.input<typeof productFormSchema>;
export type ProductFormValues = z.output<typeof productFormSchema>;
