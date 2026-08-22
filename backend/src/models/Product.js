const mongoose = require("mongoose");
const { deriveVariantId, computeTotalStock } = require("./productStock");

/**
 * One selectable value on an option, e.g. "Rose Gold" under "Metal".
 * `value` is an Attribute value slug where the option is vocabulary-backed.
 */
const optionValueSchema = new mongoose.Schema(
  {
    value: { type: String, required: true },
    label: { type: String, required: true },
    // Swatch colour — meaningful for colour/metal/finish style options.
    hex: String,
    // Product shot for this value, swapped into the gallery when selected.
    image: String,
  },
  { _id: false }
);

/**
 * A variant axis. Replaces the old hardcoded colour/size pair, which allowed
 * exactly two axes and made colour mandatory for every product.
 */
const optionSchema = new mongoose.Schema(
  {
    // Display name, e.g. "Frame Colour", "Metal", "Length".
    name: { type: String, required: true },
    // AttributeGroup.key this draws its values from, when vocabulary-backed.
    groupKey: String,
    values: { type: [optionValueSchema], default: [] },
  },
  { _id: false }
);

const variantOptionValueSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    value: { type: String, required: true },
  },
  { _id: false }
);

/** One sellable combination. Stock and SKU live here and nowhere else. */
const variantSchema = new mongoose.Schema(
  {
    id: String,
    optionValues: { type: [variantOptionValueSchema], default: [] },
    stock: { type: Number, required: true, min: 0, default: 0 },
    sku: String,
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },

    // Category.slug. Deliberately NOT an enum: the enum was a hard write gate
    // that made adding a category a code change. Validated against the Category
    // collection in productController, the same way subCategory already was.
    category: { type: String, required: true },
    subCategory: { type: String, required: true },

    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, min: 0 },
    description: { type: String, required: true },
    images: { type: [String], required: true },

    /**
     * Category-specific attribute values, keyed by AttributeGroup.key.
     *
     * This replaces ~10 hand-declared top-level fields (frameShape, fabric,
     * lensOptions, fit…). Each of those cost a schema field plus edits in the
     * serializer, the facets aggregation, the filter query, both type files and
     * the admin form — roughly ten sites per attribute. As a map, adding
     * "gemstone" or "strapDrop" is a data operation.
     *
     * Values are strings (select), string arrays (multiselect) or numbers.
     */
    attributes: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: () => new Map(),
    },

    options: { type: [optionSchema], default: [] },
    variants: { type: [variantSchema], default: [] },
    stock: { type: Number, default: 0 },

    isNewArrival: { type: Boolean, default: false },
    isBestSeller: { type: Boolean, default: false },
    rating: { type: Number, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 },
    pairsWith: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    tags: [String],

    // Nothing reaches the storefront until it is explicitly published.
    publishStatus: { type: String, enum: ["draft", "published"], default: "draft" },

    // --- Commerce/ops fields, admin-only (never serialized to the storefront) ---
    costPrice: { type: Number, min: 0 },
    barcode: String,
    weightGrams: { type: Number, min: 0 },

    seo: {
      title: String,
      description: String,
    },
  },
  { timestamps: true }
);

// No longer queried: both search boxes moved to utils/searchRegex.js, because
// $text matches whole words only and "avia" found nothing. Kept so the index is
// still there if a large catalogue ever makes relevance ranking worth it —
// drop it from Atlas if that never happens.
productSchema.index(
  { name: "text", tags: "text", subCategory: "text", description: "text" },
  { weights: { name: 10, tags: 4, subCategory: 2, description: 1 }, name: "product_search" }
);

productSchema.pre("save", function recomputeStock(next) {
  this.variants.forEach((variant) => {
    variant.id = deriveVariantId(variant.optionValues);
  });
  this.stock = computeTotalStock(this.variants);
  next();
});

module.exports = mongoose.model("Product", productSchema);
