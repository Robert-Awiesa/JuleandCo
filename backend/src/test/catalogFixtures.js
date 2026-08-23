const Category = require("../models/Category");
const Subcategory = require("../models/Subcategory");
const AttributeGroup = require("../models/AttributeGroup");
const Attribute = require("../models/Attribute");

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
    { name: "Optical", slug: "optical", categoryType: "eyewear" },
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

/**
 * The option lists, for tests that need real vocabulary rather than only the
 * groups that hold it — the mega-menu link validator, for one, checks that a
 * slug is a genuine option.
 *
 * Kept out of `seedCatalogConfig` deliberately: several tests create their own
 * attributes, and seeding these by default collided with them on the
 * (group, value) unique index.
 */
async function seedVocabulary() {
  await Attribute.create([
    { group: "frameShape", value: "aviator", label: "Aviator", sortOrder: 1 },
    { group: "frameShape", value: "round", label: "Round", sortOrder: 2 },
    { group: "frameShape", value: "square", label: "Square", sortOrder: 3 },
    { group: "frameShape", value: "cat-eye", label: "Cat-Eye", sortOrder: 4 },
    { group: "frameShape", value: "oversized", label: "Oversized", sortOrder: 5 },
    { group: "frameShape", value: "rectangle", label: "Rectangle", sortOrder: 6 },
    { group: "gender", value: "womens", label: "Women's", sortOrder: 1 },
    { group: "gender", value: "mens", label: "Men's", sortOrder: 2 },
    { group: "gender", value: "unisex", label: "Unisex", sortOrder: 3 },
    { group: "metal", value: "yellow-gold", label: "Yellow Gold", sortOrder: 1 },
  ]);
}

module.exports = { seedCatalogConfig, seedVocabulary, productFixture };
