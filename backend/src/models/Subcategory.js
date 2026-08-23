const mongoose = require("mongoose");

const subcategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true },
    // Category.slug. The enum here was one of the copies of the two-category
    // assumption; validated against the Category collection in the controller.
    categoryType: { type: String, required: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Same slug may exist under different categories ("small" under bags and rings).
subcategorySchema.index({ slug: 1, categoryType: 1 }, { unique: true });

module.exports = mongoose.model("Subcategory", subcategorySchema);
