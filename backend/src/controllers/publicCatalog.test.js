const request = require("supertest");
const app = require("../app");
const Product = require("../models/Product");
const Attribute = require("../models/Attribute");
const { connectTestDB, clearTestDB, closeTestDB } = require("../test/setupTestDb");

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret";
  await connectTestDB();
});
afterEach(async () => {
  await clearTestDB();
});
afterAll(async () => {
  await closeTestDB();
});

function product(overrides = {}) {
  return {
    slug: "the-aviator",
    name: "The Aviator",
    category: "eyewear",
    subCategory: "sunglasses",
    description: "A frame.",
    images: ["https://example.com/a.jpg"],
    price: 890,
    publishStatus: "published",
    variants: [
      { colorId: "tortoise", colorLabel: "Tortoise", colorHex: "#6B4226", stock: 3 },
      { colorId: "black", colorLabel: "Black", colorHex: "#121212", stock: 0 },
    ],
    ...overrides,
  };
}

test("public list hides draft products", async () => {
  await Product.create([
    product({ slug: "published-one", publishStatus: "published" }),
    product({ slug: "draft-one", publishStatus: "draft" }),
  ]);

  const res = await request(app).get("/api/products");
  expect(res.status).toBe(200);
  expect(res.body).toHaveLength(1);
  expect(res.body[0].slug).toBe("published-one");
});

test("products default to draft, so a bare create is not publicly visible", async () => {
  const p = product();
  delete p.publishStatus;
  await Product.create(p);

  const res = await request(app).get("/api/products");
  expect(res.body).toHaveLength(0);
});

test("public list exposes id, not _id", async () => {
  const created = await Product.create(product());
  const res = await request(app).get("/api/products");
  expect(res.body[0].id).toBe(String(created._id));
  expect(res.body[0]._id).toBeUndefined();
});

test("public list derives colour swatches with per-colour stock", async () => {
  await Product.create(product());
  const res = await request(app).get("/api/products");
  expect(res.body[0].colors).toEqual([
    { id: "tortoise", label: "Tortoise", hex: "#6B4226", inStock: true },
    { id: "black", label: "Black", hex: "#121212", inStock: false },
  ]);
});

test("public list never leaks cost price or barcode", async () => {
  await Product.create(product({ costPrice: 400, barcode: "555" }));
  const res = await request(app).get("/api/products");
  expect(res.body[0].costPrice).toBeUndefined();
  expect(res.body[0].barcode).toBeUndefined();
});

test("filters by lens type against lensOptions", async () => {
  await Product.create([
    product({ slug: "polarised-frame", lensOptions: ["polarised", "clear"] }),
    product({ slug: "clear-only", lensOptions: ["clear"] }),
  ]);

  const res = await request(app).get("/api/products?lensType=polarised");
  expect(res.body.map((p) => p.slug)).toEqual(["polarised-frame"]);
});

test("accepts comma-separated multi-select filters", async () => {
  await Product.create([
    product({ slug: "a", frameShape: "aviator" }),
    product({ slug: "b", frameShape: "round" }),
    product({ slug: "c", frameShape: "square" }),
  ]);

  const res = await request(app).get("/api/products?frameShape=aviator,square");
  expect(res.body.map((p) => p.slug).sort()).toEqual(["a", "c"]);
});

test("slug endpoint 404s for a draft product", async () => {
  await Product.create(product({ slug: "hidden", publishStatus: "draft" }));
  const res = await request(app).get("/api/products/slug/hidden");
  expect(res.status).toBe(404);
});

test("slug endpoint returns related products, excluding unpublished pairs", async () => {
  const live = await Product.create(product({ slug: "live-pair" }));
  const hidden = await Product.create(product({ slug: "hidden-pair", publishStatus: "draft" }));
  await Product.create(product({ slug: "hero", pairsWith: [live._id, hidden._id] }));

  const res = await request(app).get("/api/products/slug/hero");
  expect(res.status).toBe(200);
  expect(res.body.related.map((p) => p.slug)).toEqual(["live-pair"]);
});

test("facets label raw values using the attribute vocabulary", async () => {
  await Attribute.create({ group: "frameShape", value: "aviator", label: "Aviator" });
  await Product.create(product({ frameShape: "aviator" }));

  const res = await request(app).get("/api/products/facets");
  expect(res.status).toBe(200);
  expect(res.body.groups.frameShape).toEqual([
    expect.objectContaining({ value: "aviator", label: "Aviator" }),
  ]);
});

test("facets fall back to the raw value when no vocabulary entry exists", async () => {
  await Product.create(product({ frameShape: "unlisted-shape" }));
  const res = await request(app).get("/api/products/facets");
  expect(res.body.groups.frameShape[0].label).toBe("unlisted-shape");
});

test("facets flatten array-valued fields like lensOptions", async () => {
  await Product.create([
    product({ slug: "a", lensOptions: ["polarised", "clear"] }),
    product({ slug: "b", lensOptions: ["clear", "smoke"] }),
  ]);

  const res = await request(app).get("/api/products/facets");
  expect(res.body.groups.lensType.map((o) => o.value).sort()).toEqual(["clear", "polarised", "smoke"]);
});

test("facets ignore draft products", async () => {
  await Product.create(product({ slug: "d", publishStatus: "draft", frameShape: "aviator" }));
  const res = await request(app).get("/api/products/facets");
  expect(res.body.groups.frameShape).toEqual([]);
});

test("facets report price bounds across the published catalogue", async () => {
  await Product.create([
    product({ slug: "cheap", price: 100 }),
    product({ slug: "dear", price: 900 }),
  ]);
  const res = await request(app).get("/api/products/facets");
  expect(res.body.priceBounds).toEqual([100, 900]);
});

test("facets on an empty catalogue return an empty shape, not an error", async () => {
  const res = await request(app).get("/api/products/facets");
  expect(res.status).toBe(200);
  expect(res.body.subCategories).toEqual([]);
});
