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
    frameShape: String,
    lensColor: String,
    clothingSize: [String],
    fabric: String,
    variants: { type: [variantSchema], default: [] },
    stock: { type: Number, default: 0 },
    isNew: { type: Boolean, default: false },
    isBestSeller: { type: Boolean, default: false },
    rating: { type: Number, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 },
    pairsWith: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    tags: [String],
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
