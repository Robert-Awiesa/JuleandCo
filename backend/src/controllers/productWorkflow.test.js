const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../app");
const User = require("../models/User");
const Product = require("../models/Product");
const { connectTestDB, clearTestDB, closeTestDB } = require("../test/setupTestDb");
const { seedCatalogConfig, productFixture } = require("../test/catalogFixtures");
const { publishBlockers } = require("../utils/productReadiness");

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

async function adminToken() {
  const admin = await User.create({
    name: "Admin",
    email: "admin@test.com",
    password: "password123",
    role: "admin",
  });
  return jwt.sign({ id: admin._id, role: "admin" }, process.env.JWT_SECRET);
}

function asAdmin(req, token) {
  return req.set("Cookie", [`token=${token}`]);
}

describe("publish readiness", () => {
  test("a complete product has nothing blocking it", () => {
    expect(publishBlockers(productFixture())).toEqual([]);
  });

  test("names every missing piece rather than just the first", () => {
    const ids = publishBlockers({
      images: [],
      subCategory: "",
      price: 0,
      // Values supplied so this test reports only the four it is about, and
      // not the separate "a value for every option" rule as well.
      options: [{ name: "Metal", values: [{ value: "gold", label: "Gold" }] }],
      variants: [],
    }).map((b) => b.id);

    expect(ids).toEqual(["images", "subCategory", "price", "variants"]);
  });

  test("options with no variants block, because nothing could be added to the cart", () => {
    // A populated axis, so the missing variants are the only fault.
    const blockers = publishBlockers(
      productFixture({
        options: [{ name: "Metal", values: [{ value: "gold", label: "Gold" }] }],
        variants: [],
      })
    );
    expect(blockers.map((b) => b.id)).toEqual(["variants"]);
  });

  test("a product with no options at all is sellable as a single item", () => {
    expect(publishBlockers(productFixture({ options: [], variants: [] }))).toEqual([]);
  });
});

describe("publishing is gated", () => {
  test("creating a published product with no images is refused", async () => {
    const token = await adminToken();

    const res = await asAdmin(request(app).post("/api/products"), token).send(
      productFixture({ images: [], publishStatus: "published" })
    );

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/at least one image/i);
    expect(await Product.countDocuments()).toBe(0);
  });

  test("the same product saves fine as a draft", async () => {
    const token = await adminToken();

    const res = await asAdmin(request(app).post("/api/products"), token).send(
      productFixture({ images: [], publishStatus: "draft" })
    );

    expect(res.status).toBe(201);
  });

  test("flipping an incomplete draft to published is refused", async () => {
    const token = await adminToken();
    const product = await Product.create(productFixture({ images: [], publishStatus: "draft" }));

    const res = await asAdmin(request(app).put(`/api/products/${product._id}`), token).send({
      publishStatus: "published",
    });

    expect(res.status).toBe(400);
    // The gate must judge the merged product, not the two-field patch body.
    expect(res.body.message).toMatch(/at least one image/i);

    const after = await Product.findById(product._id);
    expect(after.publishStatus).toBe("draft");
  });
});

describe("duplicating a product", () => {
  test("copies the details and gives the copy a free slug", async () => {
    const token = await adminToken();
    const source = await Product.create(productFixture({ publishStatus: "published" }));

    const res = await asAdmin(
      request(app).post(`/api/products/${source._id}/duplicate`),
      token
    ).send();

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("The Aviator (copy)");
    expect(res.body.slug).toBe("the-aviator-copy");
    expect(res.body.price).toBe(source.price);
    expect(res.body.images).toEqual(source.images);
    expect(res.body._id).not.toBe(String(source._id));
  });

  test("the copy is a draft, so it cannot double-list on the storefront", async () => {
    const token = await adminToken();
    const source = await Product.create(productFixture({ publishStatus: "published" }));

    const res = await asAdmin(
      request(app).post(`/api/products/${source._id}/duplicate`),
      token
    ).send();

    expect(res.body.publishStatus).toBe("draft");
  });

  test("stock is not copied — it belongs to the original piece", async () => {
    const token = await adminToken();
    const source = await Product.create(productFixture());

    const res = await asAdmin(
      request(app).post(`/api/products/${source._id}/duplicate`),
      token
    ).send();

    expect(res.body.stock).toBe(0);
    expect(res.body.variants.every((v) => v.stock === 0)).toBe(true);
    // The axes themselves survive; only the counts are cleared.
    expect(res.body.variants).toHaveLength(source.variants.length);
  });

  test("duplicating twice does not collide on the slug", async () => {
    const token = await adminToken();
    const source = await Product.create(productFixture());

    await asAdmin(request(app).post(`/api/products/${source._id}/duplicate`), token).send();
    const second = await asAdmin(
      request(app).post(`/api/products/${source._id}/duplicate`),
      token
    ).send();

    expect(second.status).toBe(201);
    expect(second.body.slug).toBe("the-aviator-copy-2");
  });

  test("requires an admin", async () => {
    const source = await Product.create(productFixture());
    const res = await request(app).post(`/api/products/${source._id}/duplicate`).send();
    expect(res.status).toBe(401);
  });
});

describe("bulk actions", () => {
  test("publishes everything that is ready", async () => {
    const token = await adminToken();
    const a = await Product.create(productFixture({ slug: "a", publishStatus: "draft" }));
    const b = await Product.create(productFixture({ slug: "b", publishStatus: "draft" }));

    const res = await asAdmin(request(app).patch("/api/products/bulk"), token).send({
      ids: [a._id, b._id],
      action: "publish",
    });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(2);
    expect(res.body.skipped).toEqual([]);
    expect(await Product.countDocuments({ publishStatus: "published" })).toBe(2);
  });

  test("skips the ones that are not ready, and says which", async () => {
    const token = await adminToken();
    const ready = await Product.create(productFixture({ slug: "ready", publishStatus: "draft" }));
    const broken = await Product.create(
      productFixture({ slug: "broken", name: "No Photos", images: [], publishStatus: "draft" })
    );

    const res = await asAdmin(request(app).patch("/api/products/bulk"), token).send({
      ids: [ready._id, broken._id],
      action: "publish",
    });

    expect(res.body.updated).toBe(1);
    expect(res.body.skipped).toHaveLength(1);
    expect(res.body.skipped[0].name).toBe("No Photos");
    expect(res.body.skipped[0].blockers[0].id).toBe("images");

    // Select-all must not become a way to put a broken card on the storefront.
    expect((await Product.findById(broken._id)).publishStatus).toBe("draft");
    expect((await Product.findById(ready._id)).publishStatus).toBe("published");
  });

  test("unpublishing has no such gate — hiding is always safe", async () => {
    const token = await adminToken();
    const product = await Product.create(productFixture({ images: [], publishStatus: "published" }));

    const res = await asAdmin(request(app).patch("/api/products/bulk"), token).send({
      ids: [product._id],
      action: "unpublish",
    });

    expect(res.body.updated).toBe(1);
    expect((await Product.findById(product._id)).publishStatus).toBe("draft");
  });

  test("marks every variant out of stock whatever axes it has", async () => {
    const token = await adminToken();
    const product = await Product.create(
      productFixture({
        variants: [
          { id: "gold-40", optionValues: [{ name: "Metal", value: "gold" }], stock: 5 },
          { id: "gold-45", optionValues: [{ name: "Metal", value: "gold" }], stock: 7 },
        ],
      })
    );

    const res = await asAdmin(request(app).patch("/api/products/bulk"), token).send({
      ids: [product._id],
      action: "outOfStock",
    });

    expect(res.body.updated).toBe(1);
    const after = await Product.findById(product._id);
    expect(after.variants.map((v) => v.stock)).toEqual([0, 0]);
    expect(after.stock).toBe(0);
  });

  test("an empty selection is refused rather than silently updating everything", async () => {
    const token = await adminToken();
    const res = await asAdmin(request(app).patch("/api/products/bulk"), token).send({
      ids: [],
      action: "unpublish",
    });
    expect(res.status).toBe(400);
  });

  test("an unknown action is refused", async () => {
    const token = await adminToken();
    const product = await Product.create(productFixture());
    const res = await asAdmin(request(app).patch("/api/products/bulk"), token).send({
      ids: [product._id],
      action: "deleteEverything",
    });
    expect(res.status).toBe(400);
  });

  test("requires an admin", async () => {
    const res = await request(app)
      .patch("/api/products/bulk")
      .send({ ids: ["x"], action: "publish" });
    expect(res.status).toBe(401);
  });
});

describe("admin search", () => {
  test("matches a partial word, which $text could not", async () => {
    const token = await adminToken();
    await Product.create(productFixture({ name: "The Aviator", slug: "the-aviator" }));

    const res = await asAdmin(request(app).get("/api/products/admin?search=avia"), token);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].name).toBe("The Aviator");
  });

  test("ignores case", async () => {
    const token = await adminToken();
    await Product.create(productFixture({ name: "The Aviator" }));
    const res = await asAdmin(request(app).get("/api/products/admin?search=AVIATOR"), token);
    expect(res.body.items).toHaveLength(1);
  });

  test("finds a product by its variant SKU", async () => {
    const token = await adminToken();
    await Product.create(
      productFixture({
        variants: [
          { optionValues: [{ name: "Metal", value: "gold" }], stock: 1, sku: "JC-NECK-001" },
        ],
      })
    );

    const res = await asAdmin(request(app).get("/api/products/admin?search=NECK-001"), token);
    expect(res.body.items).toHaveLength(1);
  });

  test("a regex metacharacter is matched literally, not executed", async () => {
    const token = await adminToken();
    await Product.create(productFixture({ name: "The Aviator" }));

    // Unescaped, ".*" would match everything and look like a working search.
    const res = await asAdmin(request(app).get("/api/products/admin?search=.*"), token);
    expect(res.body.items).toHaveLength(0);
  });
});

describe("storefront search", () => {
  test("a shopper typing a partial word sees the product", async () => {
    await Product.create(productFixture({ name: "The Aviator", publishStatus: "published" }));

    // $text matched whole words only, so this returned an empty shop.
    const res = await request(app).get("/api/products?search=avia");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("The Aviator");
  });

  test("drafts stay hidden from search", async () => {
    await Product.create(productFixture({ name: "The Aviator", publishStatus: "draft" }));
    const res = await request(app).get("/api/products?search=avia");
    expect(res.body).toHaveLength(0);
  });

  test("search still combines with a filter", async () => {
    await Product.create(
      productFixture({ name: "The Aviator", publishStatus: "published", price: 890 })
    );

    const match = await request(app).get("/api/products?search=avia&maxPrice=1000");
    const pricedOut = await request(app).get("/api/products?search=avia&maxPrice=100");

    expect(match.body).toHaveLength(1);
    expect(pricedOut.body).toHaveLength(0);
  });
});

describe("refusals a person can act on", () => {
  test("a clashing slug names the field and says how to fix it", async () => {
    const token = await adminToken();
    await Product.create(productFixture({ slug: "gold-hoops" }));

    const res = await asAdmin(request(app).post("/api/products"), token).send(
      productFixture({ slug: "gold-hoops", name: "Gold Hoops II" })
    );

    expect(res.status).toBe(400);
    // Was "Duplicate field value entered", which named neither.
    expect(res.body.message).toMatch(/gold-hoops/);
    expect(res.body.message).toMatch(/slug/i);
  });

  test("a missing category asks for one instead of reporting undefined", async () => {
    const token = await adminToken();

    const res = await asAdmin(request(app).post("/api/products"), token).send({
      name: "No Category",
      slug: "no-category",
      price: 10,
      description: "x",
      images: ["https://example.com/a.jpg"],
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/choose a category/i);
    expect(res.body.message).not.toMatch(/undefined/);
  });

  test("a missing sub-category names the category it belongs to", async () => {
    const token = await adminToken();

    const res = await asAdmin(request(app).post("/api/products"), token).send({
      name: "No Sub",
      slug: "no-sub",
      category: "eyewear",
      price: 10,
      description: "x",
      images: ["https://example.com/a.jpg"],
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/sub-category for Eyewear/i);
  });

  test("an unknown sub-category names the category by its label, not its slug", async () => {
    const token = await adminToken();

    const res = await asAdmin(request(app).post("/api/products"), token).send(
      productFixture({ subCategory: "not-a-real-sub" })
    );

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Eyewear/);
  });
});
