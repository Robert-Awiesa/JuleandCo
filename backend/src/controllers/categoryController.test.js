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

/**
 * Attribute groups reference categories by slug, and an **empty** `categories`
 * list means "applies to every category". So pulling a deleted slug out of a
 * group that named only that one does not orphan it — it silently widens it,
 * and a Fabric field starts appearing on eyewear.
 */
const AttributeGroup = require("../models/AttributeGroup");

describe("deleting a category with attribute groups attached", () => {
  test("is refused when a group applies to it and nothing else, and names the group", async () => {
    const token = await adminToken();
    const category = await Category.create({ name: "Apparel", slug: "apparel", type: "apparel" });
    await AttributeGroup.create({ key: "fabric", label: "Fabric", categories: ["apparel"] });

    const res = await request(app)
      .delete(`/api/categories/id/${category._id}`)
      .set("Cookie", [`token=${token}`]);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/Fabric/);
    // Refused rather than silently widened.
    expect(await Category.findById(category._id)).not.toBeNull();
    expect((await AttributeGroup.findOne({ key: "fabric" })).categories).toEqual(["apparel"]);
  });

  test("a group covering other categories just loses this one", async () => {
    const token = await adminToken();
    const category = await Category.create({ name: "Apparel", slug: "apparel", type: "apparel" });
    await AttributeGroup.create({
      key: "occasion",
      label: "Occasion",
      categories: ["apparel", "jewellery"],
    });

    const res = await request(app)
      .delete(`/api/categories/id/${category._id}`)
      .set("Cookie", [`token=${token}`]);

    expect(res.status).toBe(200);
    // Left pointing at a category that no longer exists would be a dangling
    // reference nothing ever cleans up.
    expect((await AttributeGroup.findOne({ key: "occasion" })).categories).toEqual(["jewellery"]);
  });

  test("a group that applies to everything is untouched", async () => {
    const token = await adminToken();
    const category = await Category.create({ name: "Apparel", slug: "apparel", type: "apparel" });
    await AttributeGroup.create({ key: "careInstructions", label: "Care", categories: [] });

    const res = await request(app)
      .delete(`/api/categories/id/${category._id}`)
      .set("Cookie", [`token=${token}`]);

    expect(res.status).toBe(200);
    expect((await AttributeGroup.findOne({ key: "careInstructions" })).categories).toEqual([]);
  });
});
