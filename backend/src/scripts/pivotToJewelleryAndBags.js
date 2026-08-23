const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const fs = require("fs");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Category = require("../models/Category");
const Subcategory = require("../models/Subcategory");
const AttributeGroup = require("../models/AttributeGroup");
const Attribute = require("../models/Attribute");
const Product = require("../models/Product");

/**
 * Retires Apparel and stands up Jewellery and Bags.
 *
 * Apparel products are set to draft and KEPT — never deleted. They stay
 * editable in the admin and can be republished by reactivating the category.
 * A JSON backup is written first regardless.
 *
 * Idempotent: everything is upserted by natural key with $setOnInsert, so a
 * second run reports no changes and never clobbers later hand-edits.
 *
 *   node src/scripts/pivotToJewelleryAndBags.js
 */

const CATEGORIES = [
  {
    slug: "jewellery",
    name: "Jewellery",
    description: "Fine and demi-fine pieces in solid gold, vermeil and sterling silver.",
    sortOrder: 1,
    isActive: true,
    // Metal is the stocked axis. Length and ring size are added per product
    // from their own vocabularies on the Options tab.
    optionDefaults: [{ groupKey: "metal", label: "Metal", swatch: true }],
    combinedSpecs: [],
  },
  {
    slug: "bags",
    name: "Bags",
    description: "Structured leather and woven pieces, made to carry a day.",
    sortOrder: 2,
    isActive: true,
    optionDefaults: [{ label: "Colour", swatch: true }],
    combinedSpecs: [{ label: "Dimensions", template: "{heightCm} × {widthCm} × {depthCm} cm" }],
  },
];

const SUBCATEGORIES = {
  jewellery: ["Necklaces", "Anklets", "Bracelets", "Rings", "Earrings"],
  bags: ["Totes", "Shoulder Bags", "Crossbody Bags", "Clutches"],
};

const GROUPS = [
  // --- Jewellery ---
  { key: "metal", label: "Metal", categories: ["jewellery"], inputType: "multiselect", role: "variantAxis", swatch: true, filterStyle: "chips", sortOrder: 10 },
  { key: "purity", label: "Purity", categories: ["jewellery"], inputType: "select", role: "spec", filterStyle: "checkbox", sortOrder: 11 },
  { key: "gemstone", label: "Gemstone", categories: ["jewellery"], inputType: "select", role: "spec", filterStyle: "chips", sortOrder: 12 },
  { key: "chainLength", label: "Length", categories: ["jewellery"], inputType: "multiselect", role: "variantAxis", filterStyle: "chips", sortOrder: 13 },
  { key: "ringSize", label: "Ring Size", categories: ["jewellery"], inputType: "multiselect", role: "variantAxis", filterStyle: "chips", sortOrder: 14 },
  { key: "claspType", label: "Clasp", categories: ["jewellery"], inputType: "select", role: "spec", showInFilters: false, sortOrder: 15 },

  // --- Bags ---
  { key: "bagMaterial", label: "Material", categories: ["bags"], inputType: "select", role: "spec", filterStyle: "checkbox", sortOrder: 20 },
  { key: "closure", label: "Closure", categories: ["bags"], inputType: "select", role: "spec", filterStyle: "chips", sortOrder: 21 },
  { key: "strapType", label: "Strap", categories: ["bags"], inputType: "select", role: "spec", filterStyle: "chips", sortOrder: 22 },
  // Feed the category's combined "Dimensions" spec line rather than showing as
  // three separate rows on the product page.
  { key: "heightCm", label: "Height", categories: ["bags"], inputType: "number", role: "internal", unit: "cm", showInFilters: false, sortOrder: 23 },
  { key: "widthCm", label: "Width", categories: ["bags"], inputType: "number", role: "internal", unit: "cm", showInFilters: false, sortOrder: 24 },
  { key: "depthCm", label: "Depth", categories: ["bags"], inputType: "number", role: "internal", unit: "cm", showInFilters: false, sortOrder: 25 },
  { key: "strapDrop", label: "Strap Drop", categories: ["bags"], inputType: "number", role: "spec", unit: "cm", showInFilters: false, sortOrder: 26 },

  // --- Shared ---
  { key: "occasion", label: "Occasion", categories: [], inputType: "select", role: "spec", filterStyle: "chips", sortOrder: 30 },
];

const VOCAB = {
  metal: [
    { label: "Yellow Gold", hex: "#D4AF37" },
    { label: "Rose Gold", hex: "#B76E79" },
    { label: "White Gold", hex: "#E5E4E2" },
    { label: "Sterling Silver", hex: "#C0C0C0" },
    { label: "Gold Vermeil", hex: "#CDAD54" },
    { label: "Stainless Steel", hex: "#8E8E8E" },
  ],
  purity: ["925 Sterling Silver", "14k Gold", "18k Gold", "Gold Vermeil", "Gold Plated"],
  gemstone: ["Diamond", "Cubic Zirconia", "Freshwater Pearl", "Onyx", "Turquoise", "Amethyst", "Opal", "None"],
  chainLength: ["14 in", "16 in", "18 in", "20 in", "22 in", "24 in"],
  ringSize: ["5", "6", "7", "8", "9", "10"],
  claspType: ["Lobster", "Spring Ring", "Toggle", "Magnetic"],
  bagMaterial: ["Full-Grain Leather", "Suede", "Canvas", "Raffia", "Nylon", "Vegan Leather"],
  closure: ["Zip", "Magnetic Snap", "Drawstring", "Flap", "Open Top"],
  strapType: ["Shoulder", "Crossbody", "Top Handle", "Chain", "Detachable"],
  occasion: ["Everyday", "Evening", "Bridal", "Gifting"],
};

function slugify(value) {
  return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** Sizes and lengths are read by customers verbatim, so they keep their exact text. */
const VERBATIM_GROUPS = new Set(["ringSize"]);

async function pivot() {
  await connectDB();
  const changes = [];

  // --- 1. Back up everything about to be hidden -------------------------------
  const apparelProducts = await Product.find({ category: "apparel" }).lean();
  const apparelSubs = await Subcategory.find({ categoryType: "apparel" }).lean();

  if (apparelProducts.length > 0) {
    const dir = path.resolve(__dirname, "../../backups");
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = path.join(dir, "apparel-" + stamp + ".json");
    fs.writeFileSync(file, JSON.stringify({ products: apparelProducts, subcategories: apparelSubs }, null, 2));
    console.log("Backed up " + apparelProducts.length + " apparel products to " + path.relative(process.cwd(), file));
  }

  // --- 2. isActive is absent on documents written before the field existed.
  // Mongoose fills the default on read, so a raw query would silently miss them.
  const activated = await Category.collection.updateMany(
    { isActive: { $exists: false } },
    { $set: { isActive: true } }
  );
  if (activated.modifiedCount) changes.push("back-filled isActive on " + activated.modifiedCount + " categories");

  // --- 3. Draft the apparel products, retire the category ---------------------
  const drafted = await Product.collection.updateMany(
    { category: "apparel", publishStatus: { $ne: "draft" } },
    { $set: { publishStatus: "draft" } }
  );
  if (drafted.modifiedCount) changes.push("set " + drafted.modifiedCount + " apparel products to draft");

  const retired = await Category.collection.updateMany(
    { slug: "apparel", isActive: { $ne: false } },
    { $set: { isActive: false } }
  );
  if (retired.modifiedCount) changes.push("retired the Apparel category");

  // --- 4. Categories ----------------------------------------------------------
  for (const category of CATEGORIES) {
    // $setOnInsert only, so hand-edits made in the admin survive a re-run.
    const res = await Category.updateOne({ slug: category.slug }, { $setOnInsert: category }, { upsert: true });
    if (res.upsertedCount) changes.push("created category " + category.name);
  }

  // --- 5. Sub-categories ------------------------------------------------------
  for (const [categorySlug, names] of Object.entries(SUBCATEGORIES)) {
    for (const [index, name] of names.entries()) {
      const slug = slugify(name);
      const res = await Subcategory.updateOne(
        { slug, categoryType: categorySlug },
        { $setOnInsert: { name, slug, categoryType: categorySlug, sortOrder: index } },
        { upsert: true }
      );
      if (res.upsertedCount) changes.push("created sub-category " + categorySlug + "/" + slug);
    }
  }

  // --- 6. Attribute groups ----------------------------------------------------
  for (const group of GROUPS) {
    const res = await AttributeGroup.updateOne(
      { key: group.key },
      { $setOnInsert: Object.assign({ showInFilters: true, filterStyle: "chips", swatch: false }, group) },
      { upsert: true }
    );
    if (res.upsertedCount) changes.push("created attribute group " + group.key);
  }

  // --- 7. Vocabulary options --------------------------------------------------
  let optionsCreated = 0;
  for (const [group, entries] of Object.entries(VOCAB)) {
    for (const [index, entry] of entries.entries()) {
      const label = typeof entry === "string" ? entry : entry.label;
      const value = VERBATIM_GROUPS.has(group) ? label : slugify(label);
      const doc = { group, value, label, sortOrder: index };
      if (typeof entry !== "string" && entry.hex) doc.hex = entry.hex;

      const res = await Attribute.updateOne({ group, value }, { $setOnInsert: doc }, { upsert: true });
      if (res.upsertedCount) optionsCreated += 1;
    }
  }
  if (optionsCreated) changes.push("created " + optionsCreated + " vocabulary options");

  // --- Report -----------------------------------------------------------------
  console.log(changes.length === 0 ? "\nNo changes — already pivoted." : "\n" + changes.map((c) => "  " + c).join("\n"));

  const live = await Product.collection.countDocuments({ publishStatus: "published" });
  const draft = await Product.collection.countDocuments({ publishStatus: "draft" });
  const cats = await Category.find({}).sort({ sortOrder: 1 }).lean();
  console.log("\nCategories: " + cats.map((c) => c.name + (c.isActive ? "" : " (retired)")).join(", "));
  console.log("Products: " + live + " published, " + draft + " draft");
}

pivot()
  .catch((err) => {
    console.error("Pivot failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
