const mongoose = require("mongoose");

const variantSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    hex: String,
    inStock: { type: Boolean, default: true },
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
    colors: { type: [variantSchema], default: [] },
    sizes: { type: [variantSchema], default: [] },
    stock: { type: Number, required: true, min: 0, default: 0 },
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

module.exports = mongoose.model("Product", productSchema);
