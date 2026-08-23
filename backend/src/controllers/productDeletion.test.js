const mongoose = require("mongoose");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../app");
const Product = require("../models/Product");
const Order = require("../models/Order");
const Review = require("../models/Review");
const Category = require("../models/Category");
const AttributeGroup = require("../models/AttributeGroup");
const User = require("../models/User");
const { connectTestDB, clearTestDB, closeTestDB } = require("../test/setupTestDb");
const { seedCatalogConfig, productFixture } = require("../test/catalogFixtures");

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

const asAdmin = (req, token) => req.set("Cookie", [`token=${token}`]);

async function orderFor(product) {
  return Order.create({
    orderNumber: `JC-DEL${Date.now()}${Math.floor(Math.random() * 1000)}`,
    customer: { name: "Buyer", email: "buyer@example.com", phone: "0244000000" },
    items: [{ product: product._id, name: product.name, price: product.price, quantity: 1 }],
    shippingAddress: {
      fullName: "Buyer",
      phone: "0244000000",
      address: "12 Oxford Street",
      city: "Accra",
      region: "Greater Accra",
    },
    paymentMethod: "mobile_money",
    itemsPrice: product.price,
    totalPrice: product.price,
  });
}

describe("before deleting a product", () => {
  test("the admin can see what points at it", async () => {
    const token = await adminToken();
    const product = await Product.create(productFixture({ slug: "target" }));
    const partner = await Product.create(
      productFixture({ slug: "partner", pairsWith: [product._id] })
    );
    await Review.create({
      product: product._id,
      author: "A",
      email: "a@example.com",
      rating: 5,
      body: "Lovely.",
    });
    await orderFor(product);

    const res = await asAdmin(request(app).get(`/api/products/${product._id}/usage`), token);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({ orders: 1, reviews: 1, pairedWith: 1, canDelete: false })
    );
    expect(partner).toBeTruthy();
  });

  test("an untouched product reports that it is safe to delete", async () => {
    const token = await adminToken();
    const product = await Product.create(productFixture());

    const res = await asAdmin(request(app).get(`/api/products/${product._id}/usage`), token);

    expect(res.body).toEqual(
      expect.objectContaining({ orders: 0, reviews: 0, pairedWith: 0, canDelete: true })
    );
  });
});

describe("deleting a product", () => {
  test("is refused once it has been ordered, and says what to do instead", async () => {
    const token = await adminToken();
    const product = await Product.create(productFixture({ name: "The Aviator" }));
    await orderFor(product);

    const res = await asAdmin(request(app).delete(`/api/products/${product._id}`), token);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cannot be deleted/i);
    // The alternative is named, because it is what was actually wanted.
    expect(res.body.message).toMatch(/draft/i);

    // Still there, and the order still points at something real.
    expect(await Product.findById(product._id)).not.toBeNull();
  });

  test("a cancelled order still counts — the record is what matters", async () => {
    const token = await adminToken();
    const product = await Product.create(productFixture());
    const order = await orderFor(product);
    await Order.updateOne({ _id: order._id }, { $set: { status: "cancelled" } });

    const res = await asAdmin(request(app).delete(`/api/products/${product._id}`), token);
    expect(res.status).toBe(400);
  });

  test("a product nobody has ordered can go, and takes its reviews with it", async () => {
    const token = await adminToken();
    const product = await Product.create(productFixture());
    await Review.create({
      product: product._id,
      author: "A",
      email: "a@example.com",
      rating: 5,
      body: "Lovely.",
    });

    const res = await asAdmin(request(app).delete(`/api/products/${product._id}`), token);

    expect(res.status).toBe(200);
    expect(res.body.alsoRemoved.reviews).toBe(1);
    // Orphaned reviews would otherwise hang about pointing at nothing.
    expect(await Review.countDocuments()).toBe(0);
  });

  test("other products stop pointing at it", async () => {
    const token = await adminToken();
    const product = await Product.create(productFixture({ slug: "target" }));
    const partner = await Product.create(
      productFixture({ slug: "partner", pairsWith: [product._id] })
    );

    await asAdmin(request(app).delete(`/api/products/${product._id}`), token);

    const after = await Product.findById(partner._id);
    // A dangling id would sit in the cross-sell list for ever, pointing nowhere.
    expect(after.pairsWith).toHaveLength(0);
  });

  test("deleting something that is not there is a 404", async () => {
    const token = await adminToken();
    const res = await asAdmin(
      request(app).delete(`/api/products/${new mongoose.Types.ObjectId()}`),
      token
    );
    expect(res.status).toBe(404);
  });
});

describe("the admin list", () => {
  test("can be sorted by price and by stock, not only by date", async () => {
    const token = await adminToken();
    await Product.create(productFixture({ slug: "cheap", name: "Cheap", price: 50 }));
    await Product.create(productFixture({ slug: "dear", name: "Dear", price: 900 }));

    const cheapest = await asAdmin(
      request(app).get("/api/products/admin?sort=price-asc"),
      token
    );
    expect(cheapest.body.items[0].name).toBe("Cheap");

    const dearest = await asAdmin(request(app).get("/api/products/admin?sort=price-desc"), token);
    expect(dearest.body.items[0].name).toBe("Dear");
  });

  test("an unknown sort falls back rather than failing", async () => {
    const token = await adminToken();
    await Product.create(productFixture());

    const res = await asAdmin(request(app).get("/api/products/admin?sort=nonsense"), token);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
  });

  test("each row says what is stopping it going live", async () => {
    const token = await adminToken();
    await Product.create(productFixture({ publishStatus: "draft", images: [] }));

    const res = await asAdmin(request(app).get("/api/products/admin"), token);

    // Otherwise the reason is only visible by opening the product.
    expect(res.body.items[0].blockers).toContain("At least one image");
  });

  test("a complete product reports nothing blocking it", async () => {
    const token = await adminToken();
    await Product.create(productFixture({ publishStatus: "draft" }));

    const res = await asAdmin(request(app).get("/api/products/admin"), token);
    expect(res.body.items[0].blockers).toEqual([]);
  });
});

describe("a retired category is off sale", () => {
  async function retireEyewear() {
    await Category.updateOne({ slug: "eyewear" }, { $set: { isActive: false } });
  }

  test("its products cannot be published", async () => {
    const token = await adminToken();
    await retireEyewear();

    const res = await asAdmin(request(app).post("/api/products"), token).send(
      productFixture({ publishStatus: "published" })
    );

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/retired/i);
  });

  test("an existing one cannot be flipped live either", async () => {
    const token = await adminToken();
    const product = await Product.create(productFixture({ publishStatus: "draft" }));
    await retireEyewear();

    const res = await asAdmin(request(app).put(`/api/products/${product._id}`), token).send({
      publishStatus: "published",
    });

    expect(res.status).toBe(400);
    expect((await Product.findById(product._id)).publishStatus).toBe("draft");
  });

  test("bulk publish skips them and says why", async () => {
    const token = await adminToken();
    const product = await Product.create(productFixture({ publishStatus: "draft" }));
    await retireEyewear();

    const res = await asAdmin(request(app).patch("/api/products/bulk"), token).send({
      ids: [product._id],
      action: "publish",
    });

    expect(res.body.updated).toBe(0);
    expect(res.body.skipped[0].blockers[0].id).toBe("category");
  });

  test("they are not offered as ready to publish", async () => {
    const token = await adminToken();
    await Product.create(productFixture({ publishStatus: "draft" }));
    await retireEyewear();

    const res = await asAdmin(request(app).get("/api/products/attention"), token);
    // Offering it would invite relisting a line taken off sale on purpose.
    expect(res.body.find((i) => i.reason === "readyToPublish")).toBeUndefined();
  });

  test("anything already published disappears from the shop", async () => {
    await Product.create(productFixture({ publishStatus: "published" }));

    const before = await request(app).get("/api/products");
    expect(before.body).toHaveLength(1);

    await retireEyewear();

    const after = await request(app).get("/api/products");
    expect(after.body).toHaveLength(0);
  });

  test("and cannot be reached by its own URL", async () => {
    const product = await Product.create(productFixture({ publishStatus: "published" }));
    await retireEyewear();

    const res = await request(app).get(`/api/products/slug/${product.slug}`);
    // An old link would otherwise still sell something withdrawn.
    expect(res.status).toBe(404);
  });
});

describe("attributes belong to their category", () => {
  /**
   * The house is a women's shop. Frames are the one line where a men's cut is
   * worth calling out, so "Designed For" is bound to eyewear — offering it
   * elsewhere invites marking a piece for an audience the shop does not sell to.
   */
  beforeEach(async () => {
    await AttributeGroup.updateOne({ key: "gender" }, { $set: { categories: ["eyewear"] } });
  });

  test("eyewear may carry Designed For", async () => {
    const token = await adminToken();

    const res = await asAdmin(request(app).post("/api/products"), token).send(
      productFixture({ attributes: { gender: "mens" } })
    );

    expect(res.status).toBe(201);
  });

  test("jewellery may not, and is told which field and why", async () => {
    const token = await adminToken();

    const res = await asAdmin(request(app).post("/api/products"), token).send(
      productFixture({
        slug: "a-necklace",
        category: "jewellery",
        subCategory: "necklaces",
        attributes: { gender: "mens" },
      })
    );

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Designed For/);
    expect(res.body.message).toMatch(/Jewellery/);
  });

  test("an existing product cannot have it added by an update either", async () => {
    const token = await adminToken();
    const product = await Product.create(
      productFixture({ slug: "a-necklace", category: "jewellery", subCategory: "necklaces" })
    );

    const res = await asAdmin(request(app).put(`/api/products/${product._id}`), token).send({
      attributes: { gender: "mens" },
    });

    expect(res.status).toBe(400);
  });

  test("a group that applies everywhere is still accepted anywhere", async () => {
    const token = await adminToken();
    await AttributeGroup.updateOne({ key: "gender" }, { $set: { categories: [] } });

    const res = await asAdmin(request(app).post("/api/products"), token).send(
      productFixture({
        slug: "a-necklace",
        category: "jewellery",
        subCategory: "necklaces",
        attributes: { gender: "mens" },
      })
    );

    // An empty categories list means "applies everywhere" and must keep working.
    expect(res.status).toBe(201);
  });

  test("an empty value is not treated as carrying the attribute", async () => {
    const token = await adminToken();

    const res = await asAdmin(request(app).post("/api/products"), token).send(
      productFixture({
        slug: "a-necklace",
        category: "jewellery",
        subCategory: "necklaces",
        attributes: { gender: "" },
      })
    );

    // Clearing a field must not become a reason to refuse the save.
    expect(res.status).toBe(201);
  });
});
