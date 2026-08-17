const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../app");
const User = require("../models/User");
const Product = require("../models/Product");
const Subcategory = require("../models/Subcategory");
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
  variants: [{ colorId: "black", colorLabel: "Black", stock: 4 }],
};

test("rejects creating a product with an unknown sub-category", async () => {
  const token = await adminToken();
  const res = await request(app)
    .post("/api/products")
    .set("Cookie", [`token=${token}`])
    .send(basePayload);

  expect(res.status).toBe(400);
  expect(res.body.message).toMatch(/not a valid sub-category/);
});

test("creates a product once its sub-category exists", async () => {
  const token = await adminToken();
  await Subcategory.create({ name: "Sunglasses", slug: "sunglasses", categoryType: "eyewear" });

  const res = await request(app)
    .post("/api/products")
    .set("Cookie", [`token=${token}`])
    .send(basePayload);

  expect(res.status).toBe(201);
  expect(res.body.stock).toBe(4);
});

test("recomputes stock on update and ignores a client-sent stock value", async () => {
  const token = await adminToken();
  await Subcategory.create({ name: "Sunglasses", slug: "sunglasses", categoryType: "eyewear" });
  const created = await Product.create(basePayload);

  const res = await request(app)
    .put(`/api/products/${created._id}`)
    .set("Cookie", [`token=${token}`])
    .send({
      stock: 999,
      variants: [{ colorId: "black", colorLabel: "Black", stock: 7 }],
    });

  expect(res.status).toBe(200);
  expect(res.body.stock).toBe(7);
});

test("rejects updating to a sub-category that doesn't match the product's category", async () => {
  const token = await adminToken();
  await Subcategory.create({ name: "Sunglasses", slug: "sunglasses", categoryType: "eyewear" });
  await Subcategory.create({ name: "Knitwear", slug: "knitwear", categoryType: "apparel" });
  const created = await Product.create(basePayload);

  const res = await request(app)
    .put(`/api/products/${created._id}`)
    .set("Cookie", [`token=${token}`])
    .send({ category: "eyewear", subCategory: "knitwear" });

  expect(res.status).toBe(400);
});

test("persists the validated sub-category rather than a raw falsy override", async () => {
  const token = await adminToken();
  await Subcategory.create({ name: "Sunglasses", slug: "sunglasses", categoryType: "eyewear" });
  const created = await Product.create(basePayload);

  const res = await request(app)
    .put(`/api/products/${created._id}`)
    .set("Cookie", [`token=${token}`])
    .send({ category: "eyewear", subCategory: "" });

  expect(res.status).toBe(200);
  expect(res.body.subCategory).toBe("sunglasses");
});
