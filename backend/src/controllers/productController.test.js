const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../app");
const User = require("../models/User");
const Product = require("../models/Product");
const { connectTestDB, clearTestDB, closeTestDB } = require("../test/setupTestDb");
const { seedCatalogConfig } = require("../test/catalogFixtures");

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret";
  await connectTestDB();
});
beforeEach(async () => {
  // Category and sub-category are validated against real records now that the
  // schema enums are gone, so the config has to exist before any product does.
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

const basePayload = {
  slug: "test-frame",
  name: "Test Frame",
  category: "eyewear",
  subCategory: "sunglasses",
  price: 100,
  description: "A test product",
  images: ["https://example.com/a.jpg"],
  variants: [{ optionValues: [{ name: "Frame Colour", value: "black" }], stock: 4 }],
};

test("creates a product when its category and sub-category both exist", async () => {
  const token = await adminToken();

  const res = await request(app)
    .post("/api/products")
    .set("Cookie", [`token=${token}`])
    .send(basePayload);

  expect(res.status).toBe(201);
  expect(res.body.stock).toBe(4);
});

test("rejects creating a product with an unknown sub-category", async () => {
  const token = await adminToken();

  const res = await request(app)
    .post("/api/products")
    .set("Cookie", [`token=${token}`])
    .send({ ...basePayload, subCategory: "does-not-exist" });

  expect(res.status).toBe(400);
  expect(res.body.message).toMatch(/not a valid sub-category/);
});

// The category enum used to reject this at the schema level. Validation moved
// into the controller so that adding a category is a data change.
test("rejects creating a product in a category that does not exist", async () => {
  const token = await adminToken();

  const res = await request(app)
    .post("/api/products")
    .set("Cookie", [`token=${token}`])
    .send({ ...basePayload, category: "spacecraft", subCategory: "sunglasses" });

  expect(res.status).toBe(400);
  expect(res.body.message).toMatch(/not a known category/);
});

test("accepts a category that only exists because someone created it", async () => {
  const token = await adminToken();

  const res = await request(app)
    .post("/api/products")
    .set("Cookie", [`token=${token}`])
    .send({
      ...basePayload,
      slug: "opal-necklace",
      category: "jewellery",
      subCategory: "necklaces",
      attributes: { metal: "rose-gold", gemstone: "opal" },
      variants: [{ optionValues: [{ name: "Metal", value: "rose-gold" }], stock: 2 }],
    });

  expect(res.status).toBe(201);
  expect(res.body.category).toBe("jewellery");
});

test("recomputes stock on update and ignores a client-sent stock value", async () => {
  const token = await adminToken();
  const created = await Product.create(basePayload);

  const res = await request(app)
    .put(`/api/products/${created._id}`)
    .set("Cookie", [`token=${token}`])
    .send({
      stock: 999,
      variants: [{ optionValues: [{ name: "Frame Colour", value: "black" }], stock: 7 }],
    });

  expect(res.status).toBe(200);
  expect(res.body.stock).toBe(7);
});

test("rejects updating to a sub-category that doesn't match the product's category", async () => {
  const token = await adminToken();
  const created = await Product.create(basePayload);

  const res = await request(app)
    .put(`/api/products/${created._id}`)
    .set("Cookie", [`token=${token}`])
    .send({ category: "eyewear", subCategory: "necklaces" });

  expect(res.status).toBe(400);
});

test("persists the validated sub-category rather than a raw falsy override", async () => {
  const token = await adminToken();
  const created = await Product.create(basePayload);

  const res = await request(app)
    .put(`/api/products/${created._id}`)
    .set("Cookie", [`token=${token}`])
    .send({ category: "eyewear", subCategory: "" });

  expect(res.status).toBe(200);
  expect(res.body.subCategory).toBe("sunglasses");
});

test("admin list paginates and filters by stock status", async () => {
  const token = await adminToken();
  await Product.create({
    ...basePayload,
    slug: "in-stock",
    variants: [{ optionValues: [{ name: "Frame Colour", value: "black" }], stock: 10 }],
  });
  await Product.create({
    ...basePayload,
    slug: "out-of-stock",
    variants: [{ optionValues: [{ name: "Frame Colour", value: "black" }], stock: 0 }],
  });

  const res = await request(app)
    .get("/api/products/admin?stockStatus=out")
    .set("Cookie", [`token=${token}`]);

  expect(res.status).toBe(200);
  expect(res.body.total).toBe(1);
  expect(res.body.items[0].slug).toBe("out-of-stock");
});

test("admin list rejects unauthenticated requests", async () => {
  const res = await request(app).get("/api/products/admin");
  expect(res.status).toBe(401);
});

test("fetches a single product by id for admin editing", async () => {
  const token = await adminToken();
  const created = await Product.create(basePayload);

  const res = await request(app)
    .get(`/api/products/id/${created._id}`)
    .set("Cookie", [`token=${token}`]);

  expect(res.status).toBe(200);
  expect(res.body.name).toBe("Test Frame");
});

test("patches stock for specific variants and recomputes the total", async () => {
  const token = await adminToken();
  const created = await Product.create({
    ...basePayload,
    variants: [
      { optionValues: [{ name: "Frame Colour", value: "black" }], stock: 4 },
      { optionValues: [{ name: "Frame Colour", value: "tortoise" }], stock: 2 },
    ],
  });

  const res = await request(app)
    .patch(`/api/products/${created._id}/stock`)
    .set("Cookie", [`token=${token}`])
    .send({ variants: [{ id: "black", stock: 0 }] });

  expect(res.status).toBe(200);
  expect(res.body.variants.find((v) => v.id === "black").stock).toBe(0);
  expect(res.body.stock).toBe(2);
});

test("patches stock on a multi-axis variant by its composite id", async () => {
  const token = await adminToken();
  const created = await Product.create({
    ...basePayload,
    slug: "two-axis",
    variants: [
      {
        optionValues: [
          { name: "Metal", value: "rose-gold" },
          { name: "Length", value: "18in" },
        ],
        stock: 5,
      },
    ],
  });

  const res = await request(app)
    .patch(`/api/products/${created._id}/stock`)
    .set("Cookie", [`token=${token}`])
    .send({ variants: [{ id: "rose-gold--18in", stock: 1 }] });

  expect(res.status).toBe(200);
  expect(res.body.stock).toBe(1);
});

test("stock patch rejects a missing or empty variants array", async () => {
  const token = await adminToken();
  const created = await Product.create(basePayload);

  const res = await request(app)
    .patch(`/api/products/${created._id}/stock`)
    .set("Cookie", [`token=${token}`])
    .send({});

  expect(res.status).toBe(400);
});
