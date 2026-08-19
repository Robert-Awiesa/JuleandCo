const mongoose = require("mongoose");

/**
 * Defines an attribute group — what it is called, which categories it applies
 * to, how it is entered in the admin, and how it surfaces publicly.
 *
 * Groups used to be a fixed 7-value enum duplicated across four unsynchronised
 * places (the Attribute model, the controller's delete guard, the admin type
 * union, and the admin page's GROUPS const). A group missing from the delete
 * guard silently lost its in-use protection, so options could be deleted while
 * products still referenced them. Holding this as data fixes both problems:
 * one definition, and adding a group is a form entry rather than a release.
 */
const attributeGroupSchema = new mongoose.Schema(
  {
    // Stable key products store in their `attributes` map. Never renamed.
    key: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    description: String,

    // Category slugs this applies to. Empty means every category.
    categories: { type: [String], default: [] },

    inputType: {
      type: String,
      enum: ["select", "multiselect", "text", "number"],
      default: "select",
    },

    /**
     * spec        — shown in the product's spec list on the storefront.
     * selection   — customer picks one on the product page, but it does not
     *               carry stock. Lens type works this way: every lens is
     *               available in the frame, and stock is held per frame colour.
     * variantAxis — a stock-bearing option (metal, chain length, ring size).
     * internal    — admin-only, or a component of a combined spec such as the
     *               individual measurements behind "52-18-145 mm".
     */
    role: {
      type: String,
      enum: ["spec", "selection", "variantAxis", "internal"],
      default: "spec",
    },

    showInFilters: { type: Boolean, default: true },
    filterStyle: { type: String, enum: ["chips", "checkbox"], default: "chips" },

    // Whether options in this group carry a hex swatch (colours, metals).
    swatch: { type: Boolean, default: false },

    // Free-text/number groups need a unit and placeholder rather than options.
    unit: String,
    placeholder: String,

    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

attributeGroupSchema.index({ sortOrder: 1, label: 1 });

module.exports = mongoose.model("AttributeGroup", attributeGroupSchema);
