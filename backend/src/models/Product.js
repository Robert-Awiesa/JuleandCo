const mongoose = require("mongoose");
const { deriveVariantId, computeTotalStock } = require("./productStock");

const variantSchema = new mongoose.Schema(
  {
    id: String,
    colorId: { type: String, required: true },
    colorLabel: { type: String, required: true },
    colorHex: String,
    colorImage: String,
    sizeId: String,
    sizeLabel: String,
    stock: { type: Number, required: true, min: 0, default: 0 },
    sku: String,
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    category: { type: String, enum: ["eyewear", "apparel"], required: true },
    subCategory: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, min: 0 },
    description: { type: String, required: true },
    images: { type: [String], required: true },
    // --- Eyewear attributes ---
    // frameShape/frameMaterial/gender hold Attribute `value` slugs, not free text.
    frameShape: String,
    frameMaterial: String,
    // The hero lens shown in the spec list. Kept for back-compat with the
    // storefront's existing "Lens Color" row.
    lensColor: String,
    // Lens types this frame can be ordered with. Selectable on the storefront,
    // but NOT a stock axis — inventory is tracked per frame colour only.
    lensOptions: [String],
    measurements: {
      lensWidthMm: Number,
      bridgeWidthMm: Number,
      templeLengthMm: Number,
    },

    // --- Apparel attributes ---
    clothingSize: [String],
    fabric: String,
    composition: String,
    fit: String,

    // --- Shared ---
    gender: String,
    careInstructions: String,
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

productSchema.index({ name: "text", subCategory: "text", fabric: "text", frameShape: "text" });

productSchema.pre("save", function recomputeStock(next) {
  this.variants.forEach((variant) => {
    variant.id = deriveVariantId(variant.colorId, variant.sizeId);
  });
  this.stock = computeTotalStock(this.variants);
  next();
});

module.exports = mongoose.model("Product", productSchema);
