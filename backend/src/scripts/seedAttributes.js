const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Attribute = require("../models/Attribute");
const Product = require("../models/Product");

// Seeds the controlled vocabularies and migrates the existing catalogue onto
// them. Idempotent: attributes are upserted by (group, value), and products are
// only touched where a field still holds a legacy free-text value.
//
//   node src/scripts/seedAttributes.js

function slugify(value) {
  return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const VOCAB = [
  // --- Eyewear ---
  ...["Aviator", "Browline", "Cat-Eye", "Geometric", "Oval", "Oversized", "Rectangle", "Rimless", "Round", "Square", "Wayfarer"].map(
    (label, i) => ({ group: "frameShape", value: slugify(label), label, categoryType: "eyewear", sortOrder: i })
  ),
  ...[
    { label: "Clear", hex: "#EFEFEF" },
    { label: "Smoke", hex: "#4A4A4A" },
    { label: "Amber", hex: "#B4762A" },
    { label: "Gold Mirror", hex: "#CDAD54" },
    { label: "Sage Tint", hex: "#8A9A86" },
    { label: "Gradient Brown", hex: "#6B4226" },
    { label: "Polarised" },
    { label: "Photochromic" },
    { label: "Blue-Light Filtering" },
    { label: "UV400" },
    { label: "Prescription-Ready" },
  ].map((o, i) => ({ group: "lensType", value: slugify(o.label), label: o.label, hex: o.hex, categoryType: "eyewear", sortOrder: i })),
  ...["Acetate", "Bio-Acetate", "Titanium", "Stainless Steel", "Metal", "TR90", "Wood", "Combination"].map((label, i) => ({
    group: "frameMaterial", value: slugify(label), label, categoryType: "eyewear", sortOrder: i,
  })),

  // --- Apparel ---
  ...["100% Cashmere", "100% Linen", "100% Merino Wool", "100% Mulberry Silk", "Ponte Knit", "Virgin Wool", "Wool Blend", "Cotton Poplin", "Denim", "Leather"].map(
    (label, i) => ({ group: "fabric", value: slugify(label), label, categoryType: "apparel", sortOrder: i })
  ),
  // Size codes are already canonical and are embedded in variant ids, so value
  // stays identical to label here — do not slugify these.
  ...["XS", "S", "M", "L", "XL", "XXL"].map((label, i) => ({
    group: "clothingSize", value: label, label, categoryType: "apparel", sortOrder: i,
  })),
  ...["Slim", "Regular", "Relaxed", "Oversized", "Tailored"].map((label, i) => ({
    group: "fit", value: slugify(label), label, categoryType: "apparel", sortOrder: i,
  })),

  // --- Both categories (no categoryType) ---
  ...["Women's", "Men's", "Unisex"].map((label, i) => ({ group: "gender", value: slugify(label), label, sortOrder: i })),
];

async function seedAttributes() {
  await connectDB();

  let upserted = 0;
  for (const attr of VOCAB) {
    const res = await Attribute.updateOne(
      { group: attr.group, value: attr.value },
      { $set: attr },
      { upsert: true }
    );
    if (res.upsertedCount) upserted += 1;
  }
  console.log(`Vocabulary: ${VOCAB.length} options ensured (${upserted} newly created).`);

  // --- Backfill the existing catalogue ---
  // Done through the driver, not the model: Mongoose applies the schema default
  // ("draft") to hydrated documents, so a `!product.publishStatus` check on a
  // find() result is always false even when the field is absent in Mongo — and
  // the backfill silently no-ops, leaving the whole catalogue unpublished.
  const publishResult = await Product.collection.updateMany(
    { publishStatus: { $exists: false } },
    { $set: { publishStatus: "published" } }
  );
  const published = publishResult.modifiedCount;

  const products = await Product.find({});
  let migrated = 0;

  for (const product of products) {
    const changes = {};

    if (product.frameShape && product.frameShape !== slugify(product.frameShape)) {
      changes.frameShape = slugify(product.frameShape);
    }
    if (product.fabric && product.fabric !== slugify(product.fabric)) {
      changes.fabric = slugify(product.fabric);
    }
    if (product.lensColor) {
      const slug = slugify(product.lensColor);
      if (product.lensColor !== slug) changes.lensColor = slug;
      // Seed the selectable lens list from the single legacy lens colour.
      if (!product.lensOptions || product.lensOptions.length === 0) changes.lensOptions = [slug];
    }

    if (Object.keys(changes).length === 0) continue;
    migrated += 1;
    await Product.updateOne({ _id: product._id }, { $set: changes });
  }

  console.log(`Products: ${published} back-filled to published, ${migrated} migrated onto vocabulary slugs.`);
  const stillUnpublished = await Product.collection.countDocuments({ publishStatus: { $ne: "published" } });
  console.log(`Publicly visible: ${await Product.collection.countDocuments({ publishStatus: "published" })} (${stillUnpublished} not published).`);

  const unmatched = [];
  for (const group of ["frameShape", "fabric"]) {
    const field = group;
    const values = await Product.distinct(field);
    for (const value of values.filter(Boolean)) {
      if (!(await Attribute.exists({ group, value }))) unmatched.push(`${group}:${value}`);
    }
  }
  console.log(unmatched.length === 0
    ? "Every product attribute resolves to a vocabulary option."
    : `WARNING \u2014 values with no vocabulary entry: ${unmatched.join(", ")}`);
}

seedAttributes()
  .catch((err) => {
    console.error("Seed failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
