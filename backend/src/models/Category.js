const mongoose = require("mongoose");

/**
 * A top-level product category.
 *
 * This collection existed before but was decorative — nothing read it, and the
 * real gate was a two-value enum on Product.category. It is now the source of
 * truth, so adding "Jewellery", "Bags" or anything later is a record here
 * rather than an edit across ~30 code sites.
 */
const optionDefaultSchema = new mongoose.Schema(
  {
    // AttributeGroup.key supplying this axis's values. Blank means free-form
    // (the admin types the values in, as with one-off colourways).
    groupKey: String,
    // What this axis is called on this category: "Frame Colour", "Metal", "Length".
    label: { type: String, required: true },
    // A primary axis carries the swatch/image; secondary axes are plain values.
    swatch: { type: Boolean, default: false },
  },
  { _id: false }
);

/**
 * A spec line composed from several numeric attributes, e.g. eyewear's
 * "52-18-145 mm" or a bag's "30 × 20 × 12 cm". Replaces what used to be a
 * hardcoded eyewear-only branch in the public serializer.
 */
const combinedSpecSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    // Placeholders are AttributeGroup keys, e.g. "{lensWidthMm}-{bridgeWidthMm} mm".
    template: { type: String, required: true },
  },
  { _id: false }
);

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    // What Product.category stores.
    slug: { type: String, required: true, unique: true },
    description: String,
    heroImage: String,

    // Retiring a category hides it without destroying its products, which is
    // how apparel is being wound down.
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },

    optionDefaults: { type: [optionDefaultSchema], default: [] },
    combinedSpecs: { type: [combinedSpecSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Category", categorySchema);
