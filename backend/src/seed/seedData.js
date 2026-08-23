const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const { spawnSync } = require("child_process");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Category = require("../models/Category");
const Subcategory = require("../models/Subcategory");
const Product = require("../models/Product");
const User = require("../models/User");

/**
 * Brings a database up to a working configuration: categories, sub-categories,
 * vocabularies and an admin user. Run it on a fresh environment, or any time —
 * it never deletes and never overwrites.
 *
 * This replaced a seed that opened with deleteMany({}) on products, categories
 * and sub-categories, then wrote the pre-pivot colours/sizes shape. Against a
 * real database it destroyed the catalogue and the category configuration the
 * pivot introduced, and rebuilt neither: the products it wrote had no
 * options/variants, no attributes and no publishStatus, and their sub-category
 * labels no longer matched the slugs the API validates against. It also left
 * AttributeGroups and Attributes untouched, so the vocabularies survived with
 * nothing pointing at them.
 *
 * Every write here is $setOnInsert, so a category edited in the admin keeps its
 * edits. Products are not seeded at all — they are the shop's real content and
 * are created through the admin. Pass --with-examples for the four jewellery
 * drafts if you want something to look at.
 */

/**
 * Eyewear is defined here because it predates the category model and no other
 * script creates it. Jewellery and Bags come from pivotToJewelleryAndBags.js,
 * which is also what defines their vocabularies.
 */
const EYEWEAR = {
  slug: "eyewear",
  name: "Eyewear",
  description: "Sunglasses and optical frames, hand-finished in acetate and titanium.",
  isActive: true,
  sortOrder: 1,
  // Frame colour is free-form rather than vocabulary-backed: colourways are
  // named per frame, not chosen from a fixed list.
  optionDefaults: [{ label: "Frame Colour", swatch: true }],
  combinedSpecs: [
    { label: "Measurements", template: "{lensWidthMm}-{bridgeWidthMm}-{templeLengthMm} mm" },
  ],
};

const EYEWEAR_SUBCATEGORIES = [
  { name: "Sunglasses", slug: "sunglasses", categoryType: "eyewear", sortOrder: 0 },
  { name: "Optical", slug: "optical", categoryType: "eyewear", sortOrder: 1 },
];

/**
 * The vocabularies and the Jewellery/Bags configuration live in their own
 * scripts, which are idempotent and already the source of truth. Running them
 * rather than copying their contents keeps one definition of each.
 */
const DELEGATED = [
  { file: "seedAttributes.js", label: "eyewear vocabularies" },
  { file: "pivotToJewelleryAndBags.js", label: "jewellery & bags configuration" },
];

function runScript(file, label) {
  console.log(`\n--- ${label} (${file}) ---`);
  const result = spawnSync(process.execPath, [path.resolve(__dirname, "../scripts", file)], {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`${file} exited with code ${result.status}`);
  }
}

async function ensureEyewear() {
  const category = await Category.updateOne(
    { slug: EYEWEAR.slug },
    { $setOnInsert: EYEWEAR },
    { upsert: true }
  );
  console.log(category.upsertedCount ? "Created the Eyewear category" : "Eyewear already present");

  let created = 0;
  for (const sub of EYEWEAR_SUBCATEGORIES) {
    const res = await Subcategory.updateOne(
      { slug: sub.slug, categoryType: sub.categoryType },
      { $setOnInsert: sub },
      { upsert: true }
    );
    created += res.upsertedCount || 0;
  }
  console.log(`Eyewear sub-categories: ${created} created, ${EYEWEAR_SUBCATEGORIES.length - created} already present`);
}

async function ensureAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.log(
      "\nSkipping the admin user — set ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env first."
    );
    return;
  }

  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`\nAdmin user already exists: ${email}`);
    // Deliberately not resetting the password: that would silently undo a
    // change made with setAdminPassword.js. Use that script instead.
    return;
  }

  await User.create({ name: "Store Admin", email, password, role: "admin" });
  console.log(`\nCreated admin user: ${email}`);
}

async function bootstrap() {
  await connectDB();

  await ensureEyewear();
  for (const { file, label } of DELEGATED) {
    runScript(file, label);
  }

  if (process.argv.includes("--with-examples")) {
    runScript("seedJewelleryExamples.js", "example jewellery drafts");
  }

  await ensureAdmin();

  const [categories, subcategories, products] = await Promise.all([
    Category.countDocuments({ isActive: true }),
    Subcategory.countDocuments(),
    Product.countDocuments(),
  ]);

  console.log(
    `\nReady: ${categories} active categories, ${subcategories} sub-categories, ${products} products.`
  );
  console.log("Nothing was deleted. Add products through the admin at /admin/products.");
}

bootstrap()
  .catch((err) => {
    console.error("Bootstrap failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
