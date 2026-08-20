const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Attribute = require("../models/Attribute");
const Product = require("../models/Product");
const { deriveVariantId } = require("../models/productStock");

/**
 * Four example jewellery pieces, created as DRAFTS.
 *
 * They exist so the admin can be driven with realistic data before the real
 * catalogue is entered. Each one deliberately exercises a different variant
 * shape, because those are what used to be impossible:
 *
 *   1 axis   — a necklace offered in two metals
 *   2 axes   — an anklet in metals x lengths
 *   2 axes   — a ring in metals x ring sizes (a wide grid)
 *   0 axes   — studs sold as a single item
 *
 * Names, prices and imagery are placeholders. They stay drafts so nothing
 * invented can reach a customer; publish only after real photography lands.
 *
 *   node src/scripts/seedJewelleryExamples.js            # create
 *   node src/scripts/seedJewelleryExamples.js --remove   # delete again
 */

const img = (seed) => `https://picsum.photos/seed/${seed}/900/1125`;

/** Builds every combination of the given axes, with stock applied per index. */
function buildVariants(options, stocks) {
  const combos = options.reduce(
    (rows, option) => rows.flatMap((row) => option.values.map((v) => [...row, { name: option.name, value: v.value }])),
    [[]]
  );
  return combos.map((optionValues, i) => ({
    id: deriveVariantId(optionValues),
    optionValues,
    stock: stocks[i % stocks.length],
  }));
}

const METALS = {
  yellow: { value: "yellow-gold", label: "Yellow Gold", hex: "#D4AF37" },
  rose: { value: "rose-gold", label: "Rose Gold", hex: "#B76E79" },
  silver: { value: "sterling-silver", label: "Sterling Silver", hex: "#C0C0C0" },
  vermeil: { value: "gold-vermeil", label: "Gold Vermeil", hex: "#CDAD54" },
};

function lengths(...values) {
  return values.map((v) => ({ value: `${v}-in`, label: `${v} in` }));
}

function ringSizes(...values) {
  return values.map((v) => ({ value: String(v), label: String(v) }));
}

const PRODUCTS = [
  {
    slug: "the-mara-necklace",
    name: "The Mara Necklace",
    subCategory: "necklaces",
    price: 780,
    compareAtPrice: 920,
    description:
      "A fine curb chain finished with a hand-set pendant. Weighted to sit flat at the collarbone and layer without tangling.",
    images: [img("mara-necklace-1"), img("mara-necklace-2")],
    attributes: {
      purity: "925-sterling-silver",
      gemstone: "freshwater-pearl",
      claspType: "lobster",
      occasion: "everyday",
      gender: "womens",
      careInstructions: "Remove before swimming. Polish with the supplied cloth; avoid perfume and lotions.",
    },
    options: [{ name: "Metal", groupKey: "metal", values: [METALS.yellow, METALS.silver] }],
    stocks: [6, 4],
    isNewArrival: true,
  },
  {
    slug: "the-ada-anklet",
    name: "The Ada Anklet",
    subCategory: "anklets",
    price: 420,
    description:
      "A barely-there beaded anklet with an adjustable extender, cast in solid gold vermeil and sterling silver.",
    images: [img("ada-anklet-1"), img("ada-anklet-2")],
    attributes: {
      purity: "gold-vermeil",
      gemstone: "none",
      claspType: "spring-ring",
      occasion: "everyday",
      gender: "womens",
      careInstructions: "Rinse after contact with sand or salt water and dry thoroughly.",
    },
    options: [
      { name: "Metal", groupKey: "metal", values: [METALS.vermeil, METALS.silver] },
      { name: "Length", groupKey: "chainLength", values: lengths(14, 16, 18) },
    ],
    // A zero in here on purpose: it shows the disabled swatch behaviour.
    stocks: [4, 2, 0, 5, 3, 1],
    isBestSeller: true,
  },
  {
    slug: "the-nia-signet-ring",
    name: "The Nia Signet Ring",
    subCategory: "rings",
    price: 1150,
    description:
      "A softened square signet with a brushed face, sized to be worn on the index or little finger.",
    images: [img("nia-ring-1"), img("nia-ring-2")],
    attributes: {
      purity: "14k-gold",
      gemstone: "none",
      occasion: "gifting",
      gender: "unisex",
      careInstructions: "Solid gold — safe to wear daily. Re-polish annually to restore the brushed finish.",
    },
    options: [
      { name: "Metal", groupKey: "metal", values: [METALS.yellow, METALS.rose] },
      { name: "Ring Size", groupKey: "ringSize", values: ringSizes(5, 6, 7, 8, 9, 10) },
    ],
    stocks: [2, 3, 4, 3, 1, 0, 1, 2, 3, 2, 0, 1],
  },
  {
    slug: "the-zuri-studs",
    name: "The Zuri Studs",
    subCategory: "earrings",
    price: 340,
    description:
      "A pair of faceted cubic zirconia studs on hypoallergenic posts. One size, worn by everyone.",
    images: [img("zuri-studs-1")],
    attributes: {
      purity: "925-sterling-silver",
      gemstone: "cubic-zirconia",
      occasion: "evening",
      gender: "womens",
      careInstructions: "Store in the pouch provided to prevent scratching.",
    },
    // No options at all — the single-item case.
    options: [],
    stocks: [12],
  },
];

const SLUGS = PRODUCTS.map((p) => p.slug);

async function remove() {
  const res = await Product.deleteMany({ slug: { $in: SLUGS } });
  console.log(`Removed ${res.deletedCount} example product(s).`);
}

/**
 * gender was seeded by slugifying "Women's", which produced "women-s". No
 * product referenced it yet, so the slugs are corrected here rather than left
 * to leak into shop URLs forever.
 */
async function tidyGenderSlugs() {
  const inUse = await Product.collection.countDocuments({
    "attributes.gender": { $in: ["women-s", "men-s"] },
  });
  if (inUse > 0) {
    console.log(`Left gender slugs alone — ${inUse} product(s) already reference them.`);
    return;
  }

  for (const [from, to] of [["women-s", "womens"], ["men-s", "mens"]]) {
    const res = await Attribute.updateOne({ group: "gender", value: from }, { $set: { value: to } });
    if (res.modifiedCount) console.log(`Tidied gender slug ${from} -> ${to}`);
  }
}

async function seed() {
  await connectDB();

  if (process.argv.includes("--remove")) {
    await remove();
    return;
  }

  await tidyGenderSlugs();

  let created = 0;
  for (const spec of PRODUCTS) {
    const { stocks, ...rest } = spec;
    const variants = spec.options.length > 0
      ? buildVariants(spec.options, stocks)
      : [{ id: "default", optionValues: [], stock: stocks[0] }];

    const doc = {
      ...rest,
      category: "jewellery",
      // Placeholder imagery must never reach a customer.
      publishStatus: "draft",
      variants,
    };

    const existing = await Product.findOne({ slug: spec.slug });
    if (existing) continue;

    await Product.create(doc);
    created += 1;
  }

  console.log(created === 0 ? "All example products already exist." : `Created ${created} example product(s).`);

  const rows = await Product.find({ slug: { $in: SLUGS } }).lean();
  console.log("");
  rows.forEach((p) => {
    const axes = p.options.map((o) => `${o.name}(${o.values.length})`).join(" x ") || "no options";
    console.log(
      `  ${p.name.padEnd(24)} ${String(p.subCategory).padEnd(11)} ${axes.padEnd(28)} ${p.variants.length} variants, stock ${p.stock}`
    );
  });
  console.log(`\nAll drafts — publish from the admin once real photography is in.`);
}

seed()
  .catch((err) => {
    console.error("Seed failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
