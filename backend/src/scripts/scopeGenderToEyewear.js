const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const AttributeGroup = require("../models/AttributeGroup");
const Product = require("../models/Product");

/**
 * Binds "Designed For" to eyewear, and clears it from anything else.
 *
 * The group was seeded with `categories: []`, which means "applies everywhere",
 * so the product form offered it on jewellery and bags. The house is a women's
 * shop: frames are the one line where a men's cut is worth calling out, and
 * marking a necklace for men advertises to an audience the shop does not sell
 * to. Offering the field at all was the mistake.
 *
 * Idempotent — a second run reports nothing to do.
 *
 *   npm run migrate:gender-eyewear -w backend
 */
async function run() {
  await connectDB();

  const group = await AttributeGroup.findOne({ key: "gender" });
  if (!group) {
    console.log('No "gender" attribute group — nothing to do.');
    return;
  }

  const alreadyScoped =
    group.categories.length === 1 && group.categories[0] === "eyewear";

  if (alreadyScoped) {
    console.log('"Designed For" is already limited to eyewear.');
  } else {
    group.categories = ["eyewear"];
    await group.save();
    console.log('"Designed For" is now limited to eyewear.');
  }

  /**
   * Values already stored outside eyewear. Written through the raw driver: the
   * field lives in a Map, and $unset on a Map path is not something a hydrated
   * save round-trips reliably.
   */
  const stale = await Product.find(
    { category: { $ne: "eyewear" }, "attributes.gender": { $exists: true } },
    "name category attributes.gender"
  ).lean();

  if (stale.length === 0) {
    console.log("No products outside eyewear carry it.");
  } else {
    stale.forEach((p) =>
      console.log(`  clearing "${p.attributes.gender}" from ${p.name} (${p.category})`)
    );

    const res = await Product.collection.updateMany(
      { category: { $ne: "eyewear" }, "attributes.gender": { $exists: true } },
      { $unset: { "attributes.gender": "" } }
    );
    console.log(`Cleared it from ${res.modifiedCount} product(s).`);
  }

  const remaining = await Product.countDocuments({
    category: { $ne: "eyewear" },
    "attributes.gender": { $exists: true },
  });
  console.log(`\nProducts outside eyewear still carrying it: ${remaining}`);
}

run()
  .catch((err) => {
    console.error("Migration failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
