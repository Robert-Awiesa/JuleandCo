const mongoose = require("mongoose");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../app");
const Product = require("../models/Product");
const Order = require("../models/Order");
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

/** Stock lives on variants; the rollup follows from them. */
function withStock(stock, overrides = {}) {
  return productFixture({
    variants: [{ optionValues: [{ name: "Frame Colour", value: "tortoise" }], stock }],
    ...overrides,
  });
}

let orderCount = 0;
async function order({ total = 100, status = "pending", when = new Date(), shippingPrice }) {
  orderCount += 1;
  const doc = await Order.create({
    orderNumber: `JC-STATS${orderCount}`,
    customer: { name: "Buyer", email: `buyer${orderCount}@example.com`, phone: "0244000000" },
    items: [{ product: new mongoose.Types.ObjectId(), name: "A piece", price: total, quantity: 1 }],
    shippingAddress: {
      fullName: "Buyer",
      phone: "0244000000",
      address: "12 Oxford Street",
      city: "Accra",
      region: "Greater Accra",
    },
    paymentMethod: "mobile_money",
    itemsPrice: total,
    totalPrice: total,
    status,
    ...(shippingPrice !== undefined ? { shippingPrice } : {}),
  });

  // createdAt is set by timestamps, so backdating needs a direct write.
  if (when.getTime() !== doc.createdAt.getTime()) {
    await Order.collection.updateOne({ _id: doc._id }, { $set: { createdAt: when } });
  }
  return doc;
}

describe("catalogue figures", () => {
  test("counts what customers can see separately from what they cannot", async () => {
    const token = await adminToken();
    await Product.create(withStock(3, { slug: "live-1", publishStatus: "published" }));
    await Product.create(withStock(3, { slug: "live-2", publishStatus: "published" }));
    await Product.create(withStock(3, { slug: "draft-1", publishStatus: "draft" }));

    const res = await asAdmin(request(app).get("/api/products/stats"), token);

    expect(res.status).toBe(200);
    // "3 products" would read as a shop with three things in it. It has two.
    expect(res.body).toEqual(
      expect.objectContaining({ total: 3, published: 2, drafts: 1 })
    );
  });

  test("stock warnings only count published pieces", async () => {
    const token = await adminToken();
    await Product.create(withStock(0, { slug: "live-out", publishStatus: "published" }));
    await Product.create(withStock(2, { slug: "live-low", publishStatus: "published" }));
    // A draft with no stock is not a problem: nobody can see it.
    await Product.create(withStock(0, { slug: "draft-out", publishStatus: "draft" }));

    const res = await asAdmin(request(app).get("/api/products/stats"), token);

    expect(res.body.outOfStock).toBe(1);
    expect(res.body.lowStock).toBe(1);
  });

  test("value is reported at both retail and cost", async () => {
    const token = await adminToken();
    await Product.create(withStock(2, { slug: "priced", price: 100, costPrice: 40 }));

    const res = await asAdmin(request(app).get("/api/products/stats"), token);

    expect(res.body.retailValue).toBe(200);
    expect(res.body.costValue).toBe(80);
    expect(res.body.productsWithCost).toBe(1);
  });

  test("an empty catalogue reports zeroes rather than failing", async () => {
    const token = await adminToken();
    const res = await asAdmin(request(app).get("/api/products/stats"), token);
    expect(res.body).toEqual(
      expect.objectContaining({ total: 0, published: 0, drafts: 0, retailValue: 0 })
    );
  });

  test("needs an admin", async () => {
    const res = await request(app).get("/api/products/stats");
    expect(res.status).toBe(401);
  });
});

describe("what needs attention", () => {
  test("a published piece that has sold out", async () => {
    const token = await adminToken();
    await Product.create(withStock(0, { slug: "sold-out", publishStatus: "published" }));

    const res = await asAdmin(request(app).get("/api/products/attention"), token);
    expect(res.body.map((i) => i.reason)).toContain("outOfStock");
  });

  test("a draft with nothing blocking it is surfaced as ready to go live", async () => {
    const token = await adminToken();
    await Product.create(withStock(5, { slug: "ready", publishStatus: "draft" }));

    const res = await asAdmin(request(app).get("/api/products/attention"), token);
    const ready = res.body.find((i) => i.reason === "readyToPublish");

    expect(ready).toBeTruthy();
    expect(ready.slug).toBe("ready");
  });

  test("a draft still missing something is not offered as ready", async () => {
    const token = await adminToken();
    await Product.create(withStock(5, { slug: "unready", publishStatus: "draft", images: [] }));

    const res = await asAdmin(request(app).get("/api/products/attention"), token);
    expect(res.body.find((i) => i.reason === "readyToPublish")).toBeUndefined();
  });

  test("a live product missing something is flagged, saying what", async () => {
    const token = await adminToken();
    // Written past the publish gate, as pre-gate data would have been.
    const product = await Product.create(withStock(5, { slug: "broken-live" }));
    await Product.collection.updateOne(
      { _id: product._id },
      { $set: { images: [], publishStatus: "published" } }
    );

    const res = await asAdmin(request(app).get("/api/products/attention"), token);
    const incomplete = res.body.find((i) => i.reason === "incomplete");

    expect(incomplete).toBeTruthy();
    expect(incomplete.detail).toMatch(/image/i);
  });

  test("a healthy catalogue needs no attention", async () => {
    const token = await adminToken();
    await Product.create(withStock(20, { slug: "fine", publishStatus: "published" }));

    const res = await asAdmin(request(app).get("/api/products/attention"), token);
    expect(res.body).toEqual([]);
  });
});

describe("trade figures", () => {
  test("revenue is reported for this month as well as all time", async () => {
    const token = await adminToken();
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1, 15);

    await order({ total: 100 });
    await order({ total: 250, when: lastMonth });

    const res = await asAdmin(request(app).get("/api/orders/stats"), token);

    expect(res.body.revenue).toBe(350);
    expect(res.body.month.revenue).toBe(100);
    expect(res.body.lastMonth.revenue).toBe(250);
  });

  test("orders still awaiting a delivery charge are counted", async () => {
    const token = await adminToken();
    await order({ total: 100 });
    await order({ total: 100, shippingPrice: 50 });

    const res = await asAdmin(request(app).get("/api/orders/stats"), token);

    // The queue the delivery change introduced, which nothing surfaced.
    expect(res.body.awaitingDelivery).toBe(1);
  });

  test("cancelled orders are excluded from every figure", async () => {
    const token = await adminToken();
    await order({ total: 500, status: "cancelled" });

    const res = await asAdmin(request(app).get("/api/orders/stats"), token);

    expect(res.body.revenue).toBe(0);
    expect(res.body.month.revenue).toBe(0);
    expect(res.body.awaitingDelivery).toBe(0);
  });
});
