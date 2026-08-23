const mongoose = require("mongoose");

/**
 * One option inside a vocabulary, e.g. "Rose Gold" in the `metal` group.
 *
 * Two enums were removed here. `group` was a fixed 7-value list, which made
 * adding a vocabulary a code change; it is now validated against the
 * AttributeGroup collection in the controller. `categoryType` was a second,
 * competing way to bind options to categories, duplicating what
 * AttributeGroup.categories already expresses — group-level binding is now the
 * only mechanism, so there is one answer to "does this apply here?".
 *
 * Products store `value`, never `label`, so relabelling is free.
 */
const attributeSchema = new mongoose.Schema(
  {
    group: { type: String, required: true },
    value: { type: String, required: true },
    label: { type: String, required: true },
    // Swatch colour, for groups flagged `swatch` on their AttributeGroup.
    hex: String,
    description: String,
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

attributeSchema.index({ group: 1, value: 1 }, { unique: true });

module.exports = mongoose.model("Attribute", attributeSchema);
