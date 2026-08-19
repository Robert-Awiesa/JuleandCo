const request = require("supertest");
const app = require("../app");
const Product = require("../models/Product");
const Attribute = require("../models/Attribute");
const { connectTestDB, clearTestDB, closeTestDB } = require("../test/setupTestDb");
const { seedCatalogConfig, productFixture } = require("../test/catalogFixtures");

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret";
  await connectTestDB();
});
beforeEach(async () => {
  await seedCatalogConfig();
});
afterEach(async () => {
  await clearTestDB();
});
afterAll(async () => {
  await closeTestDB();
});

describe("publish gating", () => {
  test("public list hides draft products", async () => {
    await Product.create([
      productFixture({ slug: "published-one", publishStatus: "published" }),
      productFixture({ slug: "draft-one", publishStatus: "draft" }),
    ]);

    const res = await request(app).get("/api/products");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].slug).toBe("published-one");
  });

  test("products default to draft, so a bare create is not publicly visible", async () => {
    const p = productFixture();
    delete p.publishStatus;
    await Product.create(p);

    const res = await request(app).get("/api/products");
    expect(res.body).toHaveLength(0);
  });

  test("slug endpoint 404s for a draft product", async () => {
    await Product.create(productFixture({ slug: "hidden", publishStatus: "draft" }));
    const res = await request(app).get("/api/products/slug/hidden");
    expect(res.status).toBe(404);
  });

  test("slug endpoint returns related products, excluding unpublished pairs", async () => {
    const live = await Product.create(productFixture({ slug: "live-pair" }));
    const hidden = await Product.create(
      productFixture({ slug: "hidden-pair", publishStatus: "draft" })
    );
    await Product.create(productFixture({ slug: "hero", pairsWith: [live._id, hidden._id] }));

    const res = await request(app).get("/api/products/slug/hero");
    expect(res.status).toBe(200);
    expect(res.body.related.map((p) => p.slug)).toEqual(["live-pair"]);
  });
});

describe("serialization", () => {
  test("exposes id, not _id", async () => {
    const created = await Product.create(productFixture());
    const res = await request(app).get("/api/products");
    expect(res.body[0].id).toBe(String(created._id));
    expect(res.body[0]._id).toBeUndefined();
  });

  test("derives per-option availability from variant stock", async () => {
    await Product.create(productFixture());
    const res = await request(app).get("/api/products");
    const [option] = res.body[0].options;

    expect(option.name).toBe("Frame Colour");
    expect(option.values.find((v) => v.value === "tortoise").inStock).toBe(true);
    expect(option.values.find((v) => v.value === "black").inStock).toBe(false);
  });

  test("never leaks cost price or barcode", async () => {
    await Product.create(productFixture({ costPrice: 400, barcode: "555" }));
    const res = await request(app).get("/api/products");
    expect(res.body[0].costPrice).toBeUndefined();
    expect(res.body[0].barcode).toBeUndefined();
  });

  test("resolves attribute codes into labelled spec rows", async () => {
    await Attribute.create({ group: "frameShape", value: "aviator", label: "Aviator" });
    await Product.create(productFixture({ attributes: { frameShape: "aviator" } }));

    const res = await request(app).get("/api/products");
    expect(res.body[0].specs).toEqual([
      { key: "frameShape", label: "Frame Shape", value: "Aviator" },
    ]);
  });

  test("renders the category's combined measurement spec", async () => {
    await Product.create(
      productFixture({ attributes: { lensWidthMm: 52, bridgeWidthMm: 18, templeLengthMm: 145 } })
    );

    const res = await request(app).get("/api/products");
    const spec = res.body[0].specs.find((s) => s.key === "Measurements");
    expect(spec.value).toBe("52-18-145 mm");
  });

  test("offers non-stock selections separately from stocked options", async () => {
    await Attribute.create({ group: "lensType", value: "gold-mirror", label: "Gold Mirror" });
    await Product.create(productFixture({ attributes: { lensType: ["gold-mirror"] } }));

    const res = await request(app).get("/api/products");
    expect(res.body[0].selections).toEqual([
      { key: "lensType", label: "Lens", values: [{ value: "gold-mirror", label: "Gold Mirror" }] },
    ]);
  });

  // A jewellery product must serialize with no eyewear-specific handling.
  test("serializes a category the serializer has no special knowledge of", async () => {
    await Attribute.create({ group: "gemstone", value: "opal", label: "Opal" });
    await Product.create(
      productFixture({
        slug: "opal-necklace",
        name: "Opal Necklace",
        category: "jewellery",
        subCategory: "necklaces",
        attributes: { gemstone: "opal" },
        options: [
          { name: "Metal", groupKey: "metal", values: [{ value: "rose-gold", label: "Rose Gold" }] },
        ],
        variants: [{ optionValues: [{ name: "Metal", value: "rose-gold" }], stock: 2 }],
      })
    );

    const res = await request(app).get("/api/products?category=jewellery");
    expect(res.body).toHaveLength(1);
    expect(res.body[0].specs).toEqual([{ key: "gemstone", label: "Gemstone", value: "Opal" }]);
    expect(res.body[0].options[0].name).toBe("Metal");
  });
});

describe("filtering", () => {
  test("filters on an attribute stored in the map", async () => {
    await Product.create([
      productFixture({ slug: "a", attributes: { frameShape: "aviator" } }),
      productFixture({ slug: "b", attributes: { frameShape: "round" } }),
    ]);

    const res = await request(app).get("/api/products?frameShape=aviator");
    expect(res.body.map((p) => p.slug)).toEqual(["a"]);
  });

  test("accepts comma-separated multi-select filters", async () => {
    await Product.create([
      productFixture({ slug: "a", attributes: { frameShape: "aviator" } }),
      productFixture({ slug: "b", attributes: { frameShape: "round" } }),
      productFixture({ slug: "c", attributes: { frameShape: "square" } }),
    ]);

    const res = await request(app).get("/api/products?frameShape=aviator,square");
    expect(res.body.map((p) => p.slug).sort()).toEqual(["a", "c"]);
  });

  test("matches inside an array-valued attribute", async () => {
    await Product.create([
      productFixture({ slug: "polarised-frame", attributes: { lensType: ["polarised", "clear"] } }),
      productFixture({ slug: "clear-only", attributes: { lensType: ["clear"] } }),
    ]);

    const res = await request(app).get("/api/products?lensType=polarised");
    expect(res.body.map((p) => p.slug)).toEqual(["polarised-frame"]);
  });

  // Proves a filter works without any code naming it.
  test("filters on a group added purely as data", async () => {
    await Product.create([
      productFixture({ slug: "opal", category: "jewellery", subCategory: "necklaces", attributes: { gemstone: "opal" } }),
      productFixture({ slug: "ruby", category: "jewellery", subCategory: "necklaces", attributes: { gemstone: "ruby" } }),
    ]);

    const res = await request(app).get("/api/products?gemstone=opal");
    expect(res.body.map((p) => p.slug)).toEqual(["opal"]);
  });
});

describe("facets", () => {
  test("label raw values using the attribute vocabulary", async () => {
    await Attribute.create({ group: "frameShape", value: "aviator", label: "Aviator" });
    await Product.create(productFixture({ attributes: { frameShape: "aviator" } }));

    const res = await request(app).get("/api/products/facets");
    expect(res.status).toBe(200);
    expect(res.body.groups.frameShape).toEqual([
      expect.objectContaining({ value: "aviator", label: "Aviator" }),
    ]);
  });

  test("fall back to the raw value when no vocabulary entry exists", async () => {
    await Product.create(productFixture({ attributes: { frameShape: "unlisted-shape" } }));
    const res = await request(app).get("/api/products/facets");
    expect(res.body.groups.frameShape[0].label).toBe("unlisted-shape");
  });

  test("flatten array-valued attributes", async () => {
    await Product.create([
      productFixture({ slug: "a", attributes: { lensType: ["polarised", "clear"] } }),
      productFixture({ slug: "b", attributes: { lensType: ["clear", "smoke"] } }),
    ]);

    const res = await request(app).get("/api/products/facets");
    expect(res.body.groups.lensType.map((o) => o.value).sort()).toEqual([
      "clear",
      "polarised",
      "smoke",
    ]);
  });

  test("ignore draft products", async () => {
    await Product.create(
      productFixture({ slug: "d", publishStatus: "draft", attributes: { frameShape: "aviator" } })
    );
    const res = await request(app).get("/api/products/facets");
    expect(res.body.groups.frameShape).toEqual([]);
  });

  test("report price bounds across the published catalogue", async () => {
    await Product.create([
      productFixture({ slug: "cheap", price: 100 }),
      productFixture({ slug: "dear", price: 900 }),
    ]);
    const res = await request(app).get("/api/products/facets");
    expect(res.body.priceBounds).toEqual([100, 900]);
  });

  test("an empty catalogue returns an empty shape, not an error", async () => {
    const res = await request(app).get("/api/products/facets");
    expect(res.status).toBe(200);
    expect(res.body.subCategories).toEqual([]);
    expect(res.body.groups.frameShape).toEqual([]);
  });

  // The storefront renders unknown facets from this, so it must be present.
  test("describe each facet so the storefront can render one it has never seen", async () => {
    await Product.create(productFixture({ attributes: { frameShape: "aviator" } }));
    const res = await request(app).get("/api/products/facets?category=eyewear");

    expect(res.body.groupMeta).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "frameShape", label: "Frame Shape", filterStyle: "chips" }),
      ])
    );
  });

  test("narrow to the requested category's groups", async () => {
    await Product.create(
      productFixture({ slug: "n", category: "jewellery", subCategory: "necklaces" })
    );
    const res = await request(app).get("/api/products/facets?category=jewellery");

    const keys = res.body.groupMeta.map((g) => g.key);
    expect(keys).toContain("metal");
    expect(keys).not.toContain("frameShape");
  });
});
