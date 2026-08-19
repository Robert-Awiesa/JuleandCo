const { deriveVariantId, computeTotalStock } = require("./productStock");
const Product = require("./Product");
const { connectTestDB, clearTestDB, closeTestDB } = require("../test/setupTestDb");

const base = {
  slug: "test-frame",
  name: "Test Frame",
  category: "eyewear",
  subCategory: "sunglasses",
  price: 100,
  description: "A test product",
  images: ["https://example.com/a.jpg"],
};

describe("productStock helpers", () => {
  test("a single option yields its bare value as the id", () => {
    expect(deriveVariantId([{ name: "Frame Colour", value: "black" }])).toBe("black");
  });

  test("multiple options join with a double dash, in order", () => {
    expect(
      deriveVariantId([
        { name: "Frame Colour", value: "black" },
        { name: "Size", value: "m" },
      ])
    ).toBe("black--m");
  });

  // The format is unchanged from the old two-axis (colorId, sizeId) helper, so
  // ids survived the migration and stock stayed attached to the right rows.
  test("keeps the pre-migration id format", () => {
    expect(deriveVariantId([{ name: "Colour", value: "alabaster" }, { name: "Size", value: "xs" }]))
      .toBe("alabaster--xs");
  });

  test("scales past two axes", () => {
    expect(
      deriveVariantId([
        { name: "Metal", value: "rose-gold" },
        { name: "Length", value: "18in" },
        { name: "Finish", value: "matte" },
      ])
    ).toBe("rose-gold--18in--matte");
  });

  test("a product with no options still has one sellable variant", () => {
    expect(deriveVariantId([])).toBe("default");
  });

  test("computeTotalStock sums stock across all variants", () => {
    expect(computeTotalStock([{ stock: 3 }, { stock: 5 }, { stock: 0 }])).toBe(8);
  });

  test("computeTotalStock returns 0 for an empty variant list", () => {
    expect(computeTotalStock([])).toBe(0);
  });
});

describe("Product model stock recomputation", () => {
  beforeAll(async () => {
    await connectTestDB();
  });
  afterEach(async () => {
    await clearTestDB();
  });
  afterAll(async () => {
    await closeTestDB();
  });

  test("recomputes total stock and variant ids on save", async () => {
    const product = await Product.create({
      ...base,
      variants: [
        { optionValues: [{ name: "Frame Colour", value: "black" }], stock: 4 },
        { optionValues: [{ name: "Frame Colour", value: "tortoise" }], stock: 2 },
      ],
    });

    expect(product.stock).toBe(6);
    expect(product.variants.map((v) => v.id)).toEqual(["black", "tortoise"]);
  });

  test("derives a combined id for a two-axis variant", async () => {
    const product = await Product.create({
      ...base,
      slug: "test-necklace",
      variants: [
        {
          optionValues: [
            { name: "Metal", value: "rose-gold" },
            { name: "Length", value: "18in" },
          ],
          stock: 3,
        },
      ],
    });

    expect(product.variants[0].id).toBe("rose-gold--18in");
  });

  test("ignores a client-supplied stock value and recomputes it from variants", async () => {
    const product = await Product.create({
      ...base,
      slug: "test-frame-2",
      stock: 999,
      variants: [{ optionValues: [{ name: "Frame Colour", value: "black" }], stock: 3 }],
    });

    expect(product.stock).toBe(3);
  });

  test("recomputes stock again when an existing product is re-saved after a variant change", async () => {
    const product = await Product.create({
      ...base,
      slug: "test-frame-3",
      variants: [{ optionValues: [{ name: "Frame Colour", value: "black" }], stock: 3 }],
    });

    product.variants[0].stock = 10;
    await product.save();

    expect(product.stock).toBe(10);
  });

  test("stores category-specific values in the attributes map", async () => {
    const product = await Product.create({
      ...base,
      slug: "test-frame-4",
      attributes: { frameShape: "aviator", lensType: ["gold-mirror", "smoke"] },
    });

    const reloaded = await Product.findById(product._id);
    expect(reloaded.attributes.get("frameShape")).toBe("aviator");
    expect(reloaded.attributes.get("lensType")).toEqual(["gold-mirror", "smoke"]);
  });

  // The old schema hardcoded eyewear and apparel fields, so a jewellery
  // attribute had nowhere to live without a model change.
  test("accepts attributes the schema has never heard of", async () => {
    const product = await Product.create({
      ...base,
      slug: "test-necklace-2",
      category: "jewellery",
      subCategory: "necklaces",
      attributes: { metal: "rose-gold", gemstone: "opal", chainLengthCm: 45 },
    });

    const reloaded = await Product.findById(product._id);
    expect(reloaded.attributes.get("gemstone")).toBe("opal");
    expect(reloaded.attributes.get("chainLengthCm")).toBe(45);
  });

  test("a product with no options at all still gets a usable variant id", async () => {
    const product = await Product.create({
      ...base,
      slug: "test-one-size-bag",
      variants: [{ optionValues: [], stock: 5 }],
    });

    expect(product.variants[0].id).toBe("default");
    expect(product.stock).toBe(5);
  });
});
