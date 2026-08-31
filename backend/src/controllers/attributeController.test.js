const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../app");
const User = require("../models/User");
const Attribute = require("../models/Attribute");
const AttributeGroup = require("../models/AttributeGroup");
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

async function seedGroups() {
  await AttributeGroup.create([
    { key: "frameShape", label: "Frame Shape", categories: ["eyewear"] },
    { key: "metal", label: "Metal", categories: ["jewellery"] },
    { key: "gender", label: "Designed For", categories: [] },
  ]);
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
  await seedGroups();

  const res = await request(app)
    .post("/api/attributes")
    .set("Cookie", [`token=${token}`])
    .send({ group: "frameShape", value: "aviator", label: "Aviator" });

  expect(res.status).toBe(201);
  expect(res.body.label).toBe("Aviator");
});

test("rejects creation without an admin token", async () => {
  await seedGroups();
  const res = await request(app)
    .post("/api/attributes")
    .send({ group: "frameShape", value: "aviator", label: "Aviator" });
  expect(res.status).toBe(401);
});

// The group enum is gone; a group must exist as a record instead.
test("rejects an option whose group does not exist", async () => {
  const token = await adminToken();
  const res = await request(app)
    .post("/api/attributes")
    .set("Cookie", [`token=${token}`])
    .send({ group: "nonsense", value: "x", label: "X" });

  expect(res.status).toBe(400);
  expect(res.body.message).toMatch(/not a known attribute group/);
});

test("rejects a duplicate value within the same group", async () => {
  const token = await adminToken();
  await seedGroups();
  await Attribute.create({ group: "frameShape", value: "aviator", label: "Aviator" });

  const res = await request(app)
    .post("/api/attributes")
    .set("Cookie", [`token=${token}`])
    .send({ group: "frameShape", value: "aviator", label: "Aviator Again" });

  expect(res.status).toBe(409);
});

test("allows the same value in two different groups", async () => {
  const token = await adminToken();
  await seedGroups();
  await Attribute.create({ group: "frameShape", value: "round", label: "Round" });

  const res = await request(app)
    .post("/api/attributes")
    .set("Cookie", [`token=${token}`])
    .send({ group: "metal", value: "round", label: "Round" });

  expect(res.status).toBe(201);
});

test("lists options filtered by group", async () => {
  await seedGroups();
  await Attribute.create([
    { group: "frameShape", value: "aviator", label: "Aviator" },
    { group: "metal", value: "rose-gold", label: "Rose Gold" },
  ]);

  const res = await request(app).get("/api/attributes?group=metal");
  expect(res.status).toBe(200);
  expect(res.body).toHaveLength(1);
  expect(res.body[0].value).toBe("rose-gold");
});

// Category binding lives on the group now, not on each option.
test("filtering by category returns options from that category's groups plus shared ones", async () => {
  await seedGroups();
  await Attribute.create([
    { group: "frameShape", value: "aviator", label: "Aviator" },
    { group: "metal", value: "rose-gold", label: "Rose Gold" },
    { group: "gender", value: "unisex", label: "Unisex" },
  ]);

  const res = await request(app).get("/api/attributes?category=eyewear");
  expect(res.body.map((a) => a.value).sort()).toEqual(["aviator", "unisex"]);
});

test("sorts by sortOrder then label", async () => {
  await seedGroups();
  await Attribute.create([
    { group: "frameShape", value: "square", label: "Square", sortOrder: 2 },
    { group: "frameShape", value: "aviator", label: "Aviator", sortOrder: 1 },
  ]);

  const res = await request(app).get("/api/attributes?group=frameShape");
  expect(res.body.map((a) => a.value)).toEqual(["aviator", "square"]);
});

test("renames an option", async () => {
  const token = await adminToken();
  await seedGroups();
  const attr = await Attribute.create({ group: "metal", value: "rose-gold", label: "Rose Gold" });

  const res = await request(app)
    .put(`/api/attributes/${attr._id}`)
    .set("Cookie", [`token=${token}`])
    .send({ label: "Blush Gold" });

  expect(res.status).toBe(200);
  expect(res.body.label).toBe("Blush Gold");
});

// Products store `value`, so letting it change would orphan them silently.
test("ignores an attempt to change an option's value", async () => {
  const token = await adminToken();
  await seedGroups();
  const attr = await Attribute.create({ group: "metal", value: "rose-gold", label: "Rose Gold" });

  const res = await request(app)
    .put(`/api/attributes/${attr._id}`)
    .set("Cookie", [`token=${token}`])
    .send({ value: "something-else", label: "Rose Gold" });

  expect(res.status).toBe(200);
  expect(res.body.value).toBe("rose-gold");
});

test("deletes an unused option", async () => {
  const token = await adminToken();
  await seedGroups();
  const attr = await Attribute.create({ group: "metal", value: "silver", label: "Silver" });

  const res = await request(app)
    .delete(`/api/attributes/${attr._id}`)
    .set("Cookie", [`token=${token}`]);

  expect(res.status).toBe(200);
  expect(await Attribute.countDocuments()).toBe(0);
});

test("refuses to delete an option a product still uses", async () => {
  const token = await adminToken();
  await seedGroups();
  const attr = await Attribute.create({ group: "frameShape", value: "aviator", label: "Aviator" });
  await Product.create(productPayload({ attributes: { frameShape: "aviator" } }));

  const res = await request(app)
    .delete(`/api/attributes/${attr._id}`)
    .set("Cookie", [`token=${token}`]);

  expect(res.status).toBe(409);
  expect(res.body.message).toMatch(/still use it/);
  expect(await Attribute.countDocuments()).toBe(1);
});

test("refuses to delete an option used inside a multiselect attribute", async () => {
  const token = await adminToken();
  await AttributeGroup.create({ key: "lensType", label: "Lens", inputType: "multiselect" });
  const attr = await Attribute.create({ group: "lensType", value: "polarised", label: "Polarised" });
  await Product.create(productPayload({ attributes: { lensType: ["polarised", "clear"] } }));

  const res = await request(app)
    .delete(`/api/attributes/${attr._id}`)
    .set("Cookie", [`token=${token}`]);

  expect(res.status).toBe(409);
});

// The old hardcoded group->field map silently skipped this check for any group
// missing from it, so options stayed deletable while products used them.
test("guards a group the original hardcoded map never knew about", async () => {
  const token = await adminToken();
  await AttributeGroup.create({ key: "gemstone", label: "Gemstone", categories: ["jewellery"] });
  const attr = await Attribute.create({ group: "gemstone", value: "opal", label: "Opal" });
  await Product.create(productPayload({ attributes: { gemstone: "opal" } }));

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

/**
 * A variant axis stores its values in `options[].values[].value`, and does not
 * appear in `attributes` at all. The guard only ever looked at `attributes`, so
 * deleting "Yellow Gold" reported nought products using it while two necklaces
 * were actively sold in it.
 */
function axisProduct(groupKey, values, overrides = {}) {
  return productPayload({
    category: "jewellery",
    subCategory: "necklaces",
    options: [
      {
        name: "Metal",
        groupKey,
        values: values.map((v) => ({ value: v, label: v })),
      },
    ],
    variants: values.map((v) => ({
      id: v,
      optionValues: [{ name: "Metal", value: v }],
      stock: 1,
    })),
    ...overrides,
  });
}

test("refuses to delete an option a product sells as a variant axis", async () => {
  const token = await adminToken();
  await seedGroups();
  const attr = await Attribute.create({
    group: "metal",
    value: "yellow-gold",
    label: "Yellow Gold",
  });
  await Product.create(axisProduct("metal", ["yellow-gold", "sterling-silver"]));

  const res = await request(app)
    .delete(`/api/attributes/${attr._id}`)
    .set("Cookie", [`token=${token}`]);

  // Deleting this would leave the product selling a metal that no longer exists.
  expect(res.status).toBe(409);
  expect(res.body.message).toMatch(/still use it/);
  expect(await Attribute.countDocuments()).toBe(1);
});

test("an option used by neither specs nor axes is still deletable", async () => {
  const token = await adminToken();
  await seedGroups();
  const attr = await Attribute.create({ group: "metal", value: "platinum", label: "Platinum" });
  await Product.create(axisProduct("metal", ["yellow-gold"]));

  const res = await request(app)
    .delete(`/api/attributes/${attr._id}`)
    .set("Cookie", [`token=${token}`]);

  // The guard must not become "refuse everything" — tidying unused vocabulary
  // is the point of having a delete at all.
  expect(res.status).toBe(200);
});

describe("usage counts", () => {
  test("count both spec values and variant axis values", async () => {
    const token = await adminToken();
    await seedGroups();
    await Product.create(axisProduct("metal", ["yellow-gold", "sterling-silver"]));
    await Product.create(
      axisProduct("metal", ["yellow-gold"], { slug: "second", name: "Second" })
    );
    await Product.create(
      productPayload({ slug: "third", name: "Third", attributes: { frameShape: "aviator" } })
    );

    const res = await request(app)
      .get("/api/attributes/usage")
      .set("Cookie", [`token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body["metal:yellow-gold"]).toBe(2);
    expect(res.body["metal:sterling-silver"]).toBe(1);
    expect(res.body["frameShape:aviator"]).toBe(1);
  });

  test("count each value inside a multiselect", async () => {
    const token = await adminToken();
    await AttributeGroup.create({ key: "lensType", label: "Lens", inputType: "multiselect" });
    await Product.create(productPayload({ attributes: { lensType: ["polarised", "clear"] } }));

    const res = await request(app)
      .get("/api/attributes/usage")
      .set("Cookie", [`token=${token}`]);

    expect(res.body["lensType:polarised"]).toBe(1);
    expect(res.body["lensType:clear"]).toBe(1);
  });

  test("omit a value nothing uses, so unused vocabulary is visible as absent", async () => {
    const token = await adminToken();
    await seedGroups();
    await Attribute.create({ group: "metal", value: "platinum", label: "Platinum" });

    const res = await request(app)
      .get("/api/attributes/usage")
      .set("Cookie", [`token=${token}`]);

    expect(res.body["metal:platinum"]).toBeUndefined();
  });

  test("are admin-only", async () => {
    const res = await request(app).get("/api/attributes/usage");
    expect(res.status).toBe(401);
  });

  test("do not mistake the literal id \"usage\" for an attribute", async () => {
    const token = await adminToken();
    const res = await request(app)
      .get("/api/attributes/usage")
      .set("Cookie", [`token=${token}`]);

    // Registered above /:id; otherwise this would be a CastError 404.
    expect(res.status).toBe(200);
  });
});
