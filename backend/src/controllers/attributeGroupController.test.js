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

const asAdmin = (req, token) => req.set("Cookie", [`token=${token}`]);

function productPayload(overrides = {}) {
  return {
    slug: "test-piece",
    name: "Test Piece",
    category: "jewellery",
    subCategory: "necklaces",
    description: "A piece.",
    images: ["https://example.com/a.jpg"],
    price: 100,
    ...overrides,
  };
}

describe("listing groups", () => {
  beforeEach(async () => {
    await AttributeGroup.create([
      { key: "metal", label: "Metal", categories: ["jewellery"], role: "variantAxis" },
      { key: "frameShape", label: "Frame Shape", categories: ["eyewear"], role: "spec" },
      { key: "occasion", label: "Occasion", categories: [], role: "spec" },
    ]);
  });

  test("a category gets its own groups plus the shared ones", async () => {
    const res = await request(app).get("/api/attribute-groups?category=jewellery");

    // A group with no categories applies everywhere, which is how "Occasion"
    // reaches jewellery without being listed on it.
    expect(res.body.map((g) => g.key).sort()).toEqual(["metal", "occasion"]);
  });

  test("role narrows the list", async () => {
    const res = await request(app).get("/api/attribute-groups?role=variantAxis");
    expect(res.body.map((g) => g.key)).toEqual(["metal"]);
  });
});

describe("creating a group", () => {
  test("an admin can add a whole new vocabulary", async () => {
    const token = await adminToken();

    const res = await asAdmin(request(app).post("/api/attribute-groups"), token).send({
      key: "gemstone",
      label: "Gemstone",
      categories: ["jewellery"],
      role: "spec",
    });

    expect(res.status).toBe(201);
    expect(res.body.key).toBe("gemstone");
  });

  test("a duplicate key is refused by name", async () => {
    const token = await adminToken();
    await AttributeGroup.create({ key: "metal", label: "Metal" });

    const res = await asAdmin(request(app).post("/api/attribute-groups"), token).send({
      key: "metal",
      label: "Metal Again",
    });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/metal/);
  });

  test("is admin-only", async () => {
    const res = await request(app).post("/api/attribute-groups").send({ key: "x", label: "X" });
    expect(res.status).toBe(401);
  });
});

describe("editing a group", () => {
  test("label, categories and role can all be changed", async () => {
    const token = await adminToken();
    const group = await AttributeGroup.create({
      key: "metal",
      label: "Metal",
      categories: ["jewellery"],
      role: "spec",
    });

    const res = await asAdmin(request(app).put(`/api/attribute-groups/${group._id}`), token).send({
      label: "Metal & Finish",
      categories: ["jewellery", "bags"],
      role: "variantAxis",
      showInFilters: false,
      unit: "mm",
    });

    expect(res.status).toBe(200);
    expect(res.body.label).toBe("Metal & Finish");
    expect(res.body.categories).toEqual(["jewellery", "bags"]);
    expect(res.body.role).toBe("variantAxis");
    expect(res.body.showInFilters).toBe(false);
    expect(res.body.unit).toBe("mm");
  });

  test("the key is never changed, because products store it", async () => {
    const token = await adminToken();
    const group = await AttributeGroup.create({ key: "metal", label: "Metal" });

    const res = await asAdmin(request(app).put(`/api/attribute-groups/${group._id}`), token).send({
      key: "material",
      label: "Material",
    });

    expect(res.status).toBe(200);
    // Renaming it would orphan every product storing values under the old key.
    expect(res.body.key).toBe("metal");
    expect(res.body.label).toBe("Material");
  });

  test("a list group with options cannot become a free text field", async () => {
    const token = await adminToken();
    const group = await AttributeGroup.create({
      key: "metal",
      label: "Metal",
      inputType: "select",
    });
    await Attribute.create({ group: "metal", value: "gold", label: "Gold" });

    const res = await asAdmin(request(app).put(`/api/attribute-groups/${group._id}`), token).send({
      inputType: "text",
    });

    // Otherwise the options stay in the database, referenced by products, and
    // unreachable from every form — worse than being refused.
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/1 option/);
    expect((await AttributeGroup.findById(group._id)).inputType).toBe("select");
  });

  test("an empty list group can change how it is entered", async () => {
    const token = await adminToken();
    const group = await AttributeGroup.create({
      key: "strapDrop",
      label: "Strap Drop",
      inputType: "select",
    });

    const res = await asAdmin(request(app).put(`/api/attribute-groups/${group._id}`), token).send({
      inputType: "number",
      unit: "cm",
    });

    expect(res.status).toBe(200);
    expect(res.body.inputType).toBe("number");
  });

  test("switching between the two list types is always allowed", async () => {
    const token = await adminToken();
    const group = await AttributeGroup.create({
      key: "lensType",
      label: "Lens",
      inputType: "select",
    });
    await Attribute.create({ group: "lensType", value: "clear", label: "Clear" });

    const res = await asAdmin(request(app).put(`/api/attribute-groups/${group._id}`), token).send({
      inputType: "multiselect",
    });

    // Both draw from the vocabulary, so nothing is orphaned.
    expect(res.status).toBe(200);
  });

  test("a group that does not exist is a 404", async () => {
    const token = await adminToken();
    const res = await asAdmin(
      request(app).put("/api/attribute-groups/60f7c0c4b4d1c80015a1b2c3"),
      token
    ).send({ label: "Nope" });

    expect(res.status).toBe(404);
  });
});

describe("deleting a group", () => {
  test("one with options is refused, and says how many", async () => {
    const token = await adminToken();
    const group = await AttributeGroup.create({ key: "metal", label: "Metal" });
    await Attribute.create({ group: "metal", value: "gold", label: "Gold" });

    const res = await asAdmin(
      request(app).delete(`/api/attribute-groups/${group._id}`),
      token
    ).send();

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/1 option/);
  });

  test("one used only as a variant axis is refused", async () => {
    const token = await adminToken();
    const group = await AttributeGroup.create({ key: "metal", label: "Metal" });
    await Product.create(
      productPayload({
        options: [{ name: "Metal", groupKey: "metal", values: [{ value: "gold", label: "Gold" }] }],
        variants: [{ id: "gold", optionValues: [{ name: "Metal", value: "gold" }], stock: 1 }],
      })
    );

    const res = await asAdmin(
      request(app).delete(`/api/attribute-groups/${group._id}`),
      token
    ).send();

    // A variant axis never appears in `attributes`, so the old check — which
    // only looked there — reported nought products and allowed the delete.
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/still use it/);
  });

  test("an unused one is removed", async () => {
    const token = await adminToken();
    const group = await AttributeGroup.create({ key: "unused", label: "Unused" });

    const res = await asAdmin(
      request(app).delete(`/api/attribute-groups/${group._id}`),
      token
    ).send();

    expect(res.status).toBe(200);
    expect(await AttributeGroup.countDocuments()).toBe(0);
  });

  test("is admin-only", async () => {
    const group = await AttributeGroup.create({ key: "unused", label: "Unused" });
    const res = await request(app).delete(`/api/attribute-groups/${group._id}`);

    expect(res.status).toBe(401);
    expect(await AttributeGroup.countDocuments()).toBe(1);
  });
});
