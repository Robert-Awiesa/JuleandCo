const mongoose = require("mongoose");

const subcategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true },
    categoryType: { type: String, enum: ["eyewear", "apparel"], required: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

subcategorySchema.index({ slug: 1, categoryType: 1 }, { unique: true });

module.exports = mongoose.model("Subcategory", subcategorySchema);
