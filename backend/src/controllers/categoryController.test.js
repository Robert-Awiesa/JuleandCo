const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../app");
const User = require("../models/User");
const Category = require("../models/Category");
const Product = require("../models/Product");
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

test("updates a category's description", async () => {
  const token = await adminToken();
  const category = await Category.create({
    name: "Eyewear",
    slug: "eyewear",
    type: "eyewear",
  });

  const res = await request(app)
    .put(`/api/categories/id/${category._id}`)
    .set("Cookie", [`token=${token}`])
    .send({ description: "Updated description" });

  expect(res.status).toBe(200);
  expect(res.body.description).toBe("Updated description");
});

test("blocks deleting a category still referenced by a product", async () => {
  const token = await adminToken();
  const category = await Category.create({ name: "Eyewear", slug: "eyewear", type: "eyewear" });
  await Product.create({
    slug: "test-product",
    name: "Test Product",
    category: "eyewear",
    subCategory: "sunglasses",
    price: 100,
    description: "desc",
    images: ["https://example.com/a.jpg"],
    variants: [{ colorId: "black", colorLabel: "Black", stock: 1 }],
  });

  const res = await request(app)
    .delete(`/api/categories/id/${category._id}`)
    .set("Cookie", [`token=${token}`]);

  expect(res.status).toBe(409);
});

test("deletes an unreferenced category", async () => {
  const token = await adminToken();
  const category = await Category.create({ name: "Eyewear", slug: "eyewear", type: "eyewear" });

  const res = await request(app)
    .delete(`/api/categories/id/${category._id}`)
    .set("Cookie", [`token=${token}`]);

  expect(res.status).toBe(200);
  expect(await Category.findById(category._id)).toBeNull();
});
