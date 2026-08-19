const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Category = require("../models/Category");
const AttributeGroup = require("../models/AttributeGroup");
const Product = require("../models/Product");

/**
 * Moves the catalogue onto the data-driven category model.
 *
 *   node src/scripts/migrateToCategoryModel.js
 *
 * Idempotent: categories and groups are upserted by their stable key, and a
 * product is only rewritten while it still carries legacy fields.
 *
 * IMPORTANT: every product read and write here goes through the raw driver
 * (`Product.collection`), never the Mongoose model. The legacy fields being
 * migrated — colorId, sizeId, frameShape, fabric and so on — are no longer
 * declared on the schema, so a model read silently drops them and the migration
 * would appear to succeed while copying nothing. The same class of bug made the
 * publishStatus backfill a no-op (see CLAUDE.md, 2026-08-19).
 */

const CATEGORIES = [
  {
    slug: "eyewear",
    name: "Eyewear",
    description: "Sunglasses and optical frames, hand-finished in acetate and titanium.",
    sortOrder: 1,
    isActive: true,
    optionDefaults: [{ label: "Frame Colour", swatch: true }],
    combinedSpecs: [
      { label: "Measurements", template: "{lensWidthMm}-{bridgeWidthMm}-{templeLengthMm} mm" },
    ],
  },
  {
    slug: "apparel",
    name: "Apparel",
    description: "Knitwear, outerwear and shirting cut from considered natural fibers.",
    sortOrder: 2,
    isActive: true, // Phase 4 retires this; the products survive either way.
    optionDefaults: [
      { label: "Colour", swatch: true },
      { groupKey: "clothingSize", label: "Size" },
    ],
    combinedSpecs: [],
  },
];

const GROUPS = [
  // --- Eyewear ---
  { key: "frameShape", label: "Frame Shape", categories: ["eyewear"], inputType: "select", role: "spec", filterStyle: "chips", sortOrder: 1 },
  { key: "frameMaterial", label: "Frame Material", categories: ["eyewear"], inputType: "select", role: "spec", filterStyle: "checkbox", sortOrder: 2 },
  // One group replaces the old lensColor/lensOptions pair, which held the same
  // vocabulary in two fields — a single spec value plus a selectable list.
  { key: "lensType", label: "Lens", categories: ["eyewear"], inputType: "multiselect", role: "selection", filterStyle: "chips", swatch: true, sortOrder: 3 },
  { key: "lensWidthMm", label: "Lens Width", categories: ["eyewear"], inputType: "number", role: "internal", showInFilters: false, unit: "mm", sortOrder: 10 },
  { key: "bridgeWidthMm", label: "Bridge", categories: ["eyewear"], inputType: "number", role: "internal", showInFilters: false, unit: "mm", sortOrder: 11 },
  { key: "templeLengthMm", label: "Temple Length", categories: ["eyewear"], inputType: "number", role: "internal", showInFilters: false, unit: "mm", sortOrder: 12 },

  // --- Apparel (retained so the drafted products still render) ---
  { key: "fabric", label: "Fabric", categories: ["apparel"], inputType: "select", role: "spec", filterStyle: "checkbox", sortOrder: 1 },
  { key: "fit", label: "Fit", categories: ["apparel"], inputType: "select", role: "spec", filterStyle: "chips", sortOrder: 2 },
  { key: "clothingSize", label: "Size", categories: ["apparel"], inputType: "multiselect", role: "variantAxis", filterStyle: "chips", sortOrder: 3 },
  { key: "composition", label: "Composition", categories: ["apparel"], inputType: "text", role: "spec", showInFilters: false, sortOrder: 4 },

  // --- Every category ---
  { key: "gender", label: "Designed For", categories: [], inputType: "select", role: "spec", filterStyle: "chips", sortOrder: 20 },
  { key: "careInstructions", label: "Care", categories: [], inputType: "text", role: "spec", showInFilters: false, sortOrder: 21 },
];

/** Legacy top-level field -> attributes map key. */
const SCALAR_FIELDS = {
  frameShape: "frameShape",
  frameMaterial: "frameMaterial",
  fabric: "fabric",
  fit: "fit",
  composition: "composition",
  gender: "gender",
  careInstructions: "careInstructions",
};

function buildAttributes(doc) {
  const attributes = { ...(doc.attributes || {}) };

  Object.entries(SCALAR_FIELDS).forEach(([legacy, key]) => {
    if (doc[legacy] !== undefined && doc[legacy] !== null && doc[legacy] !== "") {
      attributes[key] = doc[legacy];
    }
  });

  if (Array.isArray(doc.clothingSize) && doc.clothingSize.length > 0) {
    attributes.clothingSize = doc.clothingSize;
  }

  // lensColor was the single "hero" lens and lensOptions the selectable list,
  // both drawn from the same vocabulary. Union them into one field.
  const lenses = new Set([...(doc.lensOptions || []), ...(doc.lensColor ? [doc.lensColor] : [])]);
  if (lenses.size > 0) attributes.lensType = Array.from(lenses);

  if (doc.measurements) {
    ["lensWidthMm", "bridgeWidthMm", "templeLengthMm"].forEach((key) => {
      if (doc.measurements[key] != null) attributes[key] = doc.measurements[key];
    });
  }

  return attributes;
}

/**
 * Rebuilds options[] and variants[] from the old colour/size variant shape.
 * Variant ids are unchanged: deriveVariantId still joins values with "--", so
 * "black" stays "black" and "black--m" stays "black--m". Nothing is re-keyed,
 * which keeps existing stock rows and SKUs attached to the right combination.
 */
function buildOptionsAndVariants(doc, category) {
  const legacyVariants = doc.variants || [];
  const primaryLabel = category?.optionDefaults?.[0]?.label || "Colour";
  const sizeDefault = category?.optionDefaults?.[1];
  const sizeLabel = sizeDefault?.label || "Size";

  const colours = new Map();
  const sizes = new Map();

  legacyVariants.forEach((v) => {
    if (v.colorId && !colours.has(v.colorId)) {
      colours.set(v.colorId, {
        value: v.colorId,
        label: v.colorLabel || v.colorId,
        hex: v.colorHex,
        image: v.colorImage,
      });
    }
    if (v.sizeId && !sizes.has(v.sizeId)) {
      sizes.set(v.sizeId, { value: v.sizeId, label: v.sizeLabel || v.sizeId });
    }
  });

  const options = [];
  if (colours.size > 0) {
    options.push({ name: primaryLabel, groupKey: undefined, values: Array.from(colours.values()) });
  }
  if (sizes.size > 0) {
    options.push({
      name: sizeLabel,
      groupKey: sizeDefault?.groupKey || "clothingSize",
      values: Array.from(sizes.values()),
    });
  }

  const variants = legacyVariants.map((v) => {
    const optionValues = [];
    if (v.colorId) optionValues.push({ name: primaryLabel, value: v.colorId });
    if (v.sizeId) optionValues.push({ name: sizeLabel, value: v.sizeId });

    return {
      id: v.id || optionValues.map((o) => o.value).join("--") || "default",
      optionValues,
      stock: Number(v.stock) || 0,
      ...(v.sku ? { sku: v.sku } : {}),
    };
  });

  return { options, variants };
}

async function migrate() {
  await connectDB();

  // --- Categories ---
  let categoriesUpserted = 0;
  for (const category of CATEGORIES) {
    const res = await Category.updateOne(
      { slug: category.slug },
      // $setOnInsert for isActive so a category retired later is not revived
      // by re-running the migration.
      { $set: { ...category, isActive: undefined }, $setOnInsert: { isActive: category.isActive } },
      { upsert: true }
    );
    if (res.upsertedCount) categoriesUpserted += 1;
  }
  // The legacy `type` field is meaningless now that slug is the identifier.
  await Category.collection.updateMany({}, { $unset: { type: "" } });
  console.log(`Categories: ${CATEGORIES.length} ensured (${categoriesUpserted} created).`);

  // --- Attribute groups ---
  let groupsUpserted = 0;
  for (const group of GROUPS) {
    const res = await AttributeGroup.updateOne(
      { key: group.key },
      { $set: group },
      { upsert: true }
    );
    if (res.upsertedCount) groupsUpserted += 1;
  }
  console.log(`Attribute groups: ${GROUPS.length} ensured (${groupsUpserted} created).`);

  // Attribute rows no longer carry their own category binding — the group owns it.
  const unbound = await require("../models/Attribute").collection.updateMany(
    { categoryType: { $exists: true } },
    { $unset: { categoryType: "" } }
  );
  if (unbound.modifiedCount) {
    console.log(`Attributes: dropped redundant categoryType from ${unbound.modifiedCount} option(s).`);
  }

  // --- Products (raw driver throughout) ---
  const categoryBySlug = new Map((await Category.find({}).lean()).map((c) => [c.slug, c]));
  const raw = Product.collection;
  const docs = await raw.find({}).toArray();

  let migrated = 0;
  let alreadyDone = 0;

  for (const doc of docs) {
    const hasLegacyVariants = (doc.variants || []).some((v) => v.colorId !== undefined);
    const hasLegacyFields = Object.keys(SCALAR_FIELDS).some((f) => doc[f] !== undefined)
      || doc.lensOptions !== undefined
      || doc.lensColor !== undefined
      || doc.clothingSize !== undefined
      || doc.measurements !== undefined;

    if (!hasLegacyVariants && !hasLegacyFields) {
      alreadyDone += 1;
      continue;
    }

    const category = categoryBySlug.get(doc.category);
    const attributes = buildAttributes(doc);
    const { options, variants } = buildOptionsAndVariants(doc, category);

    await raw.updateOne(
      { _id: doc._id },
      {
        $set: { attributes, options, variants },
        $unset: {
          frameShape: "",
          frameMaterial: "",
          lensColor: "",
          lensOptions: "",
          measurements: "",
          clothingSize: "",
          fabric: "",
          composition: "",
          fit: "",
          gender: "",
          careInstructions: "",
        },
      }
    );
    migrated += 1;
  }

  console.log(`Products: ${migrated} migrated, ${alreadyDone} already on the new shape.`);

  // --- Verification ---
  const stillLegacy = await raw.countDocuments({ "variants.colorId": { $exists: true } });
  const withoutOptions = await raw.countDocuments({
    options: { $size: 0 },
    "variants.0": { $exists: true },
  });
  const totalStock = await raw
    .aggregate([{ $group: { _id: null, stock: { $sum: "$stock" } } }])
    .toArray();

  console.log(`Verification: ${stillLegacy} product(s) still hold legacy variants, ` +
    `${withoutOptions} have variants but no options.`);
  console.log(`Total catalogue stock: ${totalStock[0]?.stock ?? 0} (must match the pre-migration figure).`);
  console.log(stillLegacy === 0 && withoutOptions === 0 ? "Migration complete." : "WARNING — review the counts above.");
}

migrate()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
