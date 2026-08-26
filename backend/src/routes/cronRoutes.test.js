const request = require("supertest");
const app = require("../app");
const Order = require("../models/Order");
const Product = require("../models/Product");
const { connectTestDB, clearTestDB, closeTestDB } = require("../test/setupTestDb");
const { seedCatalogConfig, productFixture } = require("../test/catalogFixtures");

const SECRET = "cron-secret-for-tests";

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret";
  await connectTestDB();
});
beforeEach(async () => {
  process.env.CRON_SECRET = SECRET;
  await seedCatalogConfig();
});
afterEach(async () => {
  await clearTestDB();
  delete process.env.CRON_SECRET;
});
afterAll(async () => {
  await closeTestDB();
});

const scheduler = (path) =>
  request(app).get(path).set("Authorization", `Bearer ${SECRET}`);

describe("only the scheduler can trigger scheduled work", () => {
  // These URLs dump the database and cancel orders. Left open they would be a
  // way for anyone to do both, repeatedly.
  const paths = ["/api/cron/expire-orders", "/api/cron/backup"];

  test.each(paths)("%s refuses an unauthenticated call", async (path) => {
    const res = await request(app).get(path);
    expect(res.status).toBe(401);
  });

  test.each(paths)("%s refuses the wrong secret", async (path) => {
    const res = await request(app).get(path).set("Authorization", "Bearer not-the-secret");
    expect(res.status).toBe(401);
  });

  test.each(paths)("%s refuses a bare secret without the Bearer scheme", async (path) => {
    const res = await request(app).get(path).set("Authorization", SECRET);
    expect(res.status).toBe(401);
  });

  test.each(paths)("%s refuses outright when no secret is configured", async (path) => {
    delete process.env.CRON_SECRET;

    const res = await request(app).get(path).set("Authorization", "Bearer anything");

    // An unset secret is a misconfiguration, and the safe reading of a missing
    // password is "no" — not "let everybody in".
    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/CRON_SECRET/);
  });
});

describe("the expiry sweep over HTTP", () => {
  async function abandonedOrder() {
    const product = await Product.create(productFixture({ price: 500 }));

    const { body: order } = await request(app)
      .post("/api/orders")
      .send({
        customer: { name: "Adjoa M.", email: "adjoa@example.com", phone: "0244000000" },
        shippingAddress: {
          fullName: "Adjoa M.",
          phone: "0244000000",
          address: "12 Oxford Street",
          city: "Accra",
          region: "Greater Accra",
        },
        paymentMethod: "mobile_money",
        items: [{ productId: product._id, variantId: "tortoise", quantity: 1 }],
      });

    await Order.collection.updateOne(
      { orderNumber: order.orderNumber },
      { $set: { createdAt: new Date(Date.now() - 90 * 60 * 1000) } }
    );

    return { order, product };
  }

  test("returns the stock a stale checkout was holding", async () => {
    const { order, product } = await abandonedOrder();

    const res = await scheduler("/api/cron/expire-orders");

    expect(res.status).toBe(200);
    expect(res.body.orderNumbers).toEqual([order.orderNumber]);

    const after = await Product.findById(product._id);
    expect(after.variants.find((v) => v.id === "tortoise").stock).toBe(3);
  });

  test("says so plainly when there is nothing to do", async () => {
    const res = await scheduler("/api/cron/expire-orders");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, expired: 0 });
  });
});
