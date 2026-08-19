const Category = require("../models/Category");
const Subcategory = require("../models/Subcategory");
const AttributeGroup = require("../models/AttributeGroup");

/**
 * Seeds the minimum catalogue configuration a product needs to exist.
 *
 * Category and sub-category are validated in the controller now that the
 * two-value enums are gone, so tests that create products must seed these
 * first — the enum used to make them implicit.
 */
async function seedCatalogConfig() {
  await Category.create([
    {
      slug: "eyewear",
      name: "Eyewear",
      sortOrder: 1,
      optionDefaults: [{ label: "Frame Colour", swatch: true }],
      combinedSpecs: [
        { label: "Measurements", template: "{lensWidthMm}-{bridgeWidthMm}-{templeLengthMm} mm" },
      ],
    },
    {
      slug: "jewellery",
      name: "Jewellery",
      sortOrder: 2,
      optionDefaults: [
        { groupKey: "metal", label: "Metal", swatch: true },
        { groupKey: "chainLength", label: "Length" },
      ],
    },
  ]);

  await Subcategory.create([
    { name: "Sunglasses", slug: "sunglasses", categoryType: "eyewear" },
    { name: "Necklaces", slug: "necklaces", categoryType: "jewellery" },
  ]);

  await AttributeGroup.create([
    { key: "frameShape", label: "Frame Shape", categories: ["eyewear"], role: "spec", filterStyle: "chips", sortOrder: 1 },
    { key: "lensType", label: "Lens", categories: ["eyewear"], inputType: "multiselect", role: "selection", sortOrder: 2 },
    { key: "lensWidthMm", label: "Lens Width", categories: ["eyewear"], inputType: "number", role: "internal", showInFilters: false, sortOrder: 10 },
    { key: "bridgeWidthMm", label: "Bridge", categories: ["eyewear"], inputType: "number", role: "internal", showInFilters: false, sortOrder: 11 },
    { key: "templeLengthMm", label: "Temple", categories: ["eyewear"], inputType: "number", role: "internal", showInFilters: false, sortOrder: 12 },
    { key: "metal", label: "Metal", categories: ["jewellery"], role: "variantAxis", filterStyle: "chips", swatch: true, sortOrder: 1 },
    { key: "gemstone", label: "Gemstone", categories: ["jewellery"], role: "spec", filterStyle: "checkbox", sortOrder: 2 },
    { key: "gender", label: "Designed For", categories: [], role: "spec", sortOrder: 20 },
  ]);
}

/** A publishable product on the new options/variants shape. */
function productFixture(overrides = {}) {
  return {
    slug: "the-aviator",
    name: "The Aviator",
    category: "eyewear",
    subCategory: "sunglasses",
    description: "A frame.",
    images: ["https://example.com/a.jpg"],
    price: 890,
    publishStatus: "published",
    options: [
      {
        name: "Frame Colour",
        values: [
          { value: "tortoise", label: "Tortoise", hex: "#6B4226" },
          { value: "black", label: "Black", hex: "#121212" },
        ],
      },
    ],
    variants: [
      { optionValues: [{ name: "Frame Colour", value: "tortoise" }], stock: 3 },
      { optionValues: [{ name: "Frame Colour", value: "black" }], stock: 0 },
    ],
    ...overrides,
  };
}

module.exports = { seedCatalogConfig, productFixture };
