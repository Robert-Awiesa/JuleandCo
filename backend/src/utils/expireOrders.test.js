const request = require("supertest");
const app = require("../app");
const Order = require("../models/Order");
const Product = require("../models/Product");
const { connectTestDB, clearTestDB, closeTestDB } = require("../test/setupTestDb");
const { seedCatalogConfig, productFixture } = require("../test/catalogFixtures");
const { expireAbandonedOrders, expiryMinutes } = require("./expireOrders");

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret";
  await connectTestDB();
});
beforeEach(async () => {
  await seedCatalogConfig();
});
afterEach(async () => {
  await clearTestDB();
  delete process.env.ORDER_EXPIRY_MINUTES;
});
afterAll(async () => {
  await closeTestDB();
});

const CUSTOMER = { name: "Adjoa M.", email: "adjoa@example.com", phone: "0244000000" };

async function placeOrder() {
  const product = await Product.create(productFixture({ price: 500 }));

  const res = await request(app)
    .post("/api/orders")
    .send({
      customer: CUSTOMER,
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

  return { order: res.body, product };
}

const stockOf = async (id) =>
  (await Product.findById(id)).variants.find((v) => v.id === "tortoise").stock;

/** Backdates an order so the sweep sees it as abandoned. */
const age = (id, minutes) =>
  Order.collection.updateOne(
    { _id: typeof id === "string" ? new (require("mongoose").Types.ObjectId)(id) : id },
    { $set: { createdAt: new Date(Date.now() - minutes * 60 * 1000) } }
  );

describe("stock held by checkouts nobody finished", () => {
  test("is returned to the catalogue once the order is stale", async () => {
    const { order, product } = await placeOrder();
    expect(await stockOf(product._id)).toBe(2);

    await age(order._id, 90);
    const { expired } = await expireAbandonedOrders();

    expect(expired).toEqual([order.orderNumber]);
    // The whole point: a shopper who closed the tab must not hold the last
    // piece off the shop indefinitely.
    expect(await stockOf(product._id)).toBe(3);
  });

  test("the order is cancelled, exactly as abandoning it by hand would", async () => {
    const { order } = await placeOrder();
    await age(order._id, 90);

    await expireAbandonedOrders();

    const after = await Order.findById(order._id);
    expect(after.status).toBe("cancelled");
    expect(after.paymentStatus).toBe("failed");
    expect(after.stockReleased).toBe(true);
  });

  test("a fresh order is left alone", async () => {
    const { order, product } = await placeOrder();

    const { expired } = await expireAbandonedOrders();

    expect(expired).toEqual([]);
    expect(await stockOf(product._id)).toBe(2);
    expect((await Order.findById(order._id)).status).toBe("pending");
  });

  test("a paid order is never touched, however old", async () => {
    const { order, product } = await placeOrder();
    await Order.updateOne({ _id: order._id }, { $set: { paymentStatus: "paid" } });
    await age(order._id, 60 * 24 * 30);

    const { expired } = await expireAbandonedOrders();

    // Someone's money is on this. Age is not a reason to cancel it.
    expect(expired).toEqual([]);
    expect(await stockOf(product._id)).toBe(2);
  });

  test("an order the admin has already confirmed is never touched", async () => {
    const { order, product } = await placeOrder();
    await Order.updateOne({ _id: order._id }, { $set: { status: "processing" } });
    await age(order._id, 90);

    const { expired } = await expireAbandonedOrders();

    expect(expired).toEqual([]);
    expect(await stockOf(product._id)).toBe(2);
  });

  test("stock is never returned twice", async () => {
    const { order, product } = await placeOrder();
    await age(order._id, 90);

    await expireAbandonedOrders();
    await age(order._id, 90);
    const second = await expireAbandonedOrders();

    // Releasing again would invent stock that does not exist.
    expect(second.expired).toEqual([]);
    expect(await stockOf(product._id)).toBe(3);
  });

  test("the window is configurable", async () => {
    process.env.ORDER_EXPIRY_MINUTES = "5";
    expect(expiryMinutes()).toBe(5);

    const { order, product } = await placeOrder();
    await age(order._id, 10);

    const { expired } = await expireAbandonedOrders();
    expect(expired).toEqual([order.orderNumber]);
    expect(await stockOf(product._id)).toBe(3);
  });

  test("a nonsense window falls back to the default rather than expiring everything", async () => {
    process.env.ORDER_EXPIRY_MINUTES = "not-a-number";
    expect(expiryMinutes()).toBe(60);

    process.env.ORDER_EXPIRY_MINUTES = "0";
    // Zero would cancel every order the instant it was placed.
    expect(expiryMinutes()).toBe(60);
  });
});
