const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../app");
const User = require("../models/User");
const Attribute = require("../models/Attribute");
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

function productPayload(overrides = {}) {
  return {
    slug: "test-frame",
    name: "Test Frame",
    category: "eyewear",
    subCategory: "sunglasses",
    description: "A frame.",
    images: ["https://example.com/a.jpg"],
    price: 100,
    ...overrides,
  };
}

test("creates an attribute option as admin", async () => {
  const token = await adminToken();
  const res = await request(app)
    .post("/api/attributes")
    .set("Cookie", [`token=${token}`])
    .send({ group: "frameShape", value: "aviator", label: "Aviator", categoryType: "eyewear" });

  expect(res.status).toBe(201);
  expect(res.body.label).toBe("Aviator");
});

test("rejects creation without an admin token", async () => {
  const res = await request(app)
    .post("/api/attributes")
    .send({ group: "frameShape", value: "aviator", label: "Aviator" });
  expect(res.status).toBe(401);
});

test("rejects an unknown attribute group", async () => {
  const token = await adminToken();
  const res = await request(app)
    .post("/api/attributes")
    .set("Cookie", [`token=${token}`])
    .send({ group: "nonsense", value: "x", label: "X" });
  expect(res.status).toBe(500);
});

test("rejects a duplicate value within the same group", async () => {
  const token = await adminToken();
  await Attribute.create({ group: "frameShape", value: "aviator", label: "Aviator" });

  const res = await request(app)
    .post("/api/attributes")
    .set("Cookie", [`token=${token}`])
    .send({ group: "frameShape", value: "aviator", label: "Aviator Again" });

  expect(res.status).toBe(409);
});

test("allows the same value in two different groups", async () => {
  const token = await adminToken();
  await Attribute.create({ group: "frameShape", value: "round", label: "Round" });

  const res = await request(app)
    .post("/api/attributes")
    .set("Cookie", [`token=${token}`])
    .send({ group: "fit", value: "round", label: "Round" });

  expect(res.status).toBe(201);
});

test("lists options filtered by group", async () => {
  await Attribute.create([
    { group: "frameShape", value: "aviator", label: "Aviator" },
    { group: "lensType", value: "polarised", label: "Polarised" },
  ]);

  const res = await request(app).get("/api/attributes?group=lensType");
  expect(res.status).toBe(200);
  expect(res.body).toHaveLength(1);
  expect(res.body[0].value).toBe("polarised");
});

test("category filter includes options that apply to both categories", async () => {
  await Attribute.create([
    { group: "frameShape", value: "aviator", label: "Aviator", categoryType: "eyewear" },
    { group: "fabric", value: "wool", label: "Wool", categoryType: "apparel" },
    { group: "gender", value: "unisex", label: "Unisex" },
  ]);

  const res = await request(app).get("/api/attributes?categoryType=eyewear");
  const values = res.body.map((a) => a.value).sort();
  expect(values).toEqual(["aviator", "unisex"]);
});

test("sorts by sortOrder then label", async () => {
  await Attribute.create([
    { group: "frameShape", value: "square", label: "Square", sortOrder: 2 },
    { group: "frameShape", value: "aviator", label: "Aviator", sortOrder: 1 },
  ]);

  const res = await request(app).get("/api/attributes?group=frameShape");
  expect(res.body.map((a) => a.value)).toEqual(["aviator", "square"]);
});

test("renames an option", async () => {
  const token = await adminToken();
  const attr = await Attribute.create({ group: "lensType", value: "smoke", label: "Smoke" });

  const res = await request(app)
    .put(`/api/attributes/${attr._id}`)
    .set("Cookie", [`token=${token}`])
    .send({ label: "Smoke Grey" });

  expect(res.status).toBe(200);
  expect(res.body.label).toBe("Smoke Grey");
});

test("deletes an unused option", async () => {
  const token = await adminToken();
  const attr = await Attribute.create({ group: "lensType", value: "smoke", label: "Smoke" });

  const res = await request(app)
    .delete(`/api/attributes/${attr._id}`)
    .set("Cookie", [`token=${token}`]);

  expect(res.status).toBe(200);
  expect(await Attribute.countDocuments()).toBe(0);
});

test("refuses to delete a frame shape still used by a product", async () => {
  const token = await adminToken();
  const attr = await Attribute.create({ group: "frameShape", value: "aviator", label: "Aviator" });
  await Product.create(productPayload({ frameShape: "aviator" }));

  const res = await request(app)
    .delete(`/api/attributes/${attr._id}`)
    .set("Cookie", [`token=${token}`]);

  expect(res.status).toBe(409);
  expect(res.body.message).toMatch(/still use it/);
  expect(await Attribute.countDocuments()).toBe(1);
});

test("refuses to delete a lens type still listed in a product's lensOptions", async () => {
  const token = await adminToken();
  const attr = await Attribute.create({ group: "lensType", value: "polarised", label: "Polarised" });
  await Product.create(productPayload({ lensOptions: ["polarised", "clear"] }));

  const res = await request(app)
    .delete(`/api/attributes/${attr._id}`)
    .set("Cookie", [`token=${token}`]);

  expect(res.status).toBe(409);
});

test("returns 404 deleting an attribute that does not exist", async () => {
  const token = await adminToken();
  const res = await request(app)
    .delete("/api/attributes/6a83bec3461143bbd41815f4")
    .set("Cookie", [`token=${token}`]);
  expect(res.status).toBe(404);
});
