const mongoose = require("mongoose");

// The controlled vocabularies behind the product form's dropdowns and the
// storefront's filter facets. Before this existed, attributes were free text in
// the admin while FilterSidebar derived its checkboxes from the distinct values
// across products — so "Aviator" and "aviator" produced two separate facets.
const ATTRIBUTE_GROUPS = [
  "frameShape",
  "lensType",
  "frameMaterial",
  "fabric",
  "clothingSize",
  "fit",
  "gender",
];

const attributeSchema = new mongoose.Schema(
  {
    group: { type: String, enum: ATTRIBUTE_GROUPS, required: true },
    value: { type: String, required: true },
    label: { type: String, required: true },
    // Only meaningful for groups a swatch can represent (lensType).
    hex: String,
    // Null/absent means the option applies to both categories.
    categoryType: { type: String, enum: ["eyewear", "apparel"] },
    description: String,
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

attributeSchema.index({ group: 1, value: 1 }, { unique: true });

module.exports = mongoose.model("Attribute", attributeSchema);
module.exports.ATTRIBUTE_GROUPS = ATTRIBUTE_GROUPS;
