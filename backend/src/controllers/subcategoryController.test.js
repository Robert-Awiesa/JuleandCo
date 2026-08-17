const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../app");
const User = require("../models/User");
const Subcategory = require("../models/Subcategory");
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

test("creates a subcategory as admin", async () => {
  const token = await adminToken();
  const res = await request(app)
    .post("/api/subcategories")
    .set("Cookie", [`token=${token}`])
    .send({ name: "Sunglasses", slug: "sunglasses", categoryType: "eyewear" });

  expect(res.status).toBe(201);
  expect(res.body.slug).toBe("sunglasses");
});

test("rejects creation without an admin token", async () => {
  const res = await request(app)
    .post("/api/subcategories")
    .send({ name: "Sunglasses", slug: "sunglasses", categoryType: "eyewear" });
  expect(res.status).toBe(401);
});

test("lists subcategories filtered by categoryType", async () => {
  await Subcategory.create([
    { name: "Sunglasses", slug: "sunglasses", categoryType: "eyewear", sortOrder: 0 },
    { name: "Knitwear", slug: "knitwear", categoryType: "apparel", sortOrder: 0 },
  ]);

  const res = await request(app).get("/api/subcategories?categoryType=eyewear");
  expect(res.status).toBe(200);
  expect(res.body).toHaveLength(1);
  expect(res.body[0].name).toBe("Sunglasses");
});

test("renames a subcategory", async () => {
  const token = await adminToken();
  const sub = await Subcategory.create({
    name: "Sunglasses",
    slug: "sunglasses",
    categoryType: "eyewear",
  });

  const res = await request(app)
    .put(`/api/subcategories/${sub._id}`)
    .set("Cookie", [`token=${token}`])
    .send({ name: "Shades" });

  expect(res.status).toBe(200);
  expect(res.body.name).toBe("Shades");
});

test("blocks deleting a subcategory still referenced by a product", async () => {
  const token = await adminToken();
  const sub = await Subcategory.create({
    name: "Sunglasses",
    slug: "sunglasses",
    categoryType: "eyewear",
  });
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
    .delete(`/api/subcategories/${sub._id}`)
    .set("Cookie", [`token=${token}`]);

  expect(res.status).toBe(409);
});

test("deletes an unreferenced subcategory", async () => {
  const token = await adminToken();
  const sub = await Subcategory.create({
    name: "Sunglasses",
    slug: "sunglasses",
    categoryType: "eyewear",
  });

  const res = await request(app)
    .delete(`/api/subcategories/${sub._id}`)
    .set("Cookie", [`token=${token}`]);

  expect(res.status).toBe(200);
  expect(await Subcategory.findById(sub._id)).toBeNull();
});
