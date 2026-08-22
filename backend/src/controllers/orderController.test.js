const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../app");
const Order = require("../models/Order");
const Product = require("../models/Product");
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
  const user = await User.create({
    name: "Admin",
    email: "admin@test.com",
    password: "password123",
    role: "admin",
  });
  return jwt.sign({ id: user._id, role: "admin" }, process.env.JWT_SECRET);
}

const CUSTOMER = { name: "Adjoa M.", email: "adjoa@example.com", phone: "0244000000" };
const ADDRESS = {
  fullName: "Adjoa M.",
  phone: "0244000000",
  address: "12 Oxford Street",
  city: "Accra",
  region: "Greater Accra",
};

/** The fixture stocks "tortoise" 3 and "black" 0. */
function orderBody(productId, overrides = {}) {
  return {
    customer: CUSTOMER,
    shippingAddress: ADDRESS,
    paymentMethod: "mobile_money",
    items: [{ productId, variantId: "tortoise", quantity: 1 }],
    ...overrides,
  };
}

describe("placing an order", () => {
  test("a guest can order without being logged in", async () => {
    const product = await Product.create(productFixture({ price: 500 }));

    const res = await request(app).post("/api/orders").send(orderBody(product._id));

    expect(res.status).toBe(201);
    expect(res.body.customer.email).toBe("adjoa@example.com");
    expect(res.body.user).toBeUndefined();
  });

  test("order numbers carry the JULES & CO prefix", async () => {
    const product = await Product.create(productFixture());
    const res = await request(app).post("/api/orders").send(orderBody(product._id));
    expect(res.body.orderNumber).toMatch(/^JC-/);
  });

  test("prices are recomputed from the catalogue, not taken from the request", async () => {
    const product = await Product.create(productFixture({ price: 500 }));

    const res = await request(app)
      .post("/api/orders")
      .send({
        ...orderBody(product._id),
        // A buyer naming their own total.
        itemsPrice: 1,
        shippingPrice: 0,
        totalPrice: 1,
      });

    expect(res.status).toBe(201);
    expect(res.body.itemsPrice).toBe(500);
    // Under the free-shipping threshold, so the flat rate applies.
    expect(res.body.shippingPrice).toBe(45);
    expect(res.body.totalPrice).toBe(545);
  });

  test("shipping is free above the threshold", async () => {
    const product = await Product.create(productFixture({ price: 1200 }));
    const res = await request(app).post("/api/orders").send(orderBody(product._id));
    expect(res.body.shippingPrice).toBe(0);
    expect(res.body.totalPrice).toBe(1200);
  });

  test("the line snapshots the product name and price", async () => {
    const product = await Product.create(productFixture({ name: "The Aviator", price: 890 }));
    const res = await request(app).post("/api/orders").send(orderBody(product._id));

    expect(res.body.items[0]).toEqual(
      expect.objectContaining({ name: "The Aviator", price: 890, quantity: 1 })
    );
  });

  test("requires contact details", async () => {
    const product = await Product.create(productFixture());
    const res = await request(app)
      .post("/api/orders")
      .send({ ...orderBody(product._id), customer: { name: "No Email" } });

    expect(res.status).toBe(400);
  });

  test("rejects an empty cart", async () => {
    const res = await request(app).post("/api/orders").send(orderBody(null, { items: [] }));
    expect(res.status).toBe(400);
  });

  test("refuses to sell a draft product", async () => {
    const product = await Product.create(productFixture({ publishStatus: "draft" }));
    const res = await request(app).post("/api/orders").send(orderBody(product._id));

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no longer available/i);
  });
});

describe("stock", () => {
  test("is decremented on the variant that was bought", async () => {
    const product = await Product.create(productFixture());

    await request(app)
      .post("/api/orders")
      .send(orderBody(product._id, { items: [{ productId: product._id, variantId: "tortoise", quantity: 2 }] }));

    const after = await Product.findById(product._id).lean();
    const tortoise = after.variants.find((v) => v.id === "tortoise");
    const black = after.variants.find((v) => v.id === "black");

    expect(tortoise.stock).toBe(1);
    expect(black.stock).toBe(0);
    // The rollup is adjusted in the same write, since the save hook cannot run.
    expect(after.stock).toBe(1);
  });

  test("an order for more than is in stock is refused", async () => {
    const product = await Product.create(productFixture());

    const res = await request(app)
      .post("/api/orders")
      .send(orderBody(product._id, { items: [{ productId: product._id, variantId: "tortoise", quantity: 99 }] }));

    expect(res.status).toBe(400);
    expect(await Order.countDocuments()).toBe(0);

    const after = await Product.findById(product._id).lean();
    expect(after.variants.find((v) => v.id === "tortoise").stock).toBe(3);
  });

  test("a sold-out variant cannot be ordered", async () => {
    const product = await Product.create(productFixture());
    const res = await request(app)
      .post("/api/orders")
      .send(orderBody(product._id, { items: [{ productId: product._id, variantId: "black", quantity: 1 }] }));

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/sold out/i);
  });

  test("stock taken for earlier lines is returned when a later line fails", async () => {
    const first = await Product.create(productFixture({ slug: "first" }));
    const second = await Product.create(productFixture({ slug: "second" }));

    const res = await request(app)
      .post("/api/orders")
      .send(
        orderBody(first._id, {
          items: [
            { productId: first._id, variantId: "tortoise", quantity: 2 },
            // Fails: only 3 exist.
            { productId: second._id, variantId: "tortoise", quantity: 99 },
          ],
        })
      );

    expect(res.status).toBe(400);

    // The first product must be back to full stock, not silently drained.
    const firstAfter = await Product.findById(first._id).lean();
    expect(firstAfter.variants.find((v) => v.id === "tortoise").stock).toBe(3);
    expect(firstAfter.stock).toBe(3);
    expect(await Order.countDocuments()).toBe(0);
  });

  test("two orders cannot both take the last piece", async () => {
    const product = await Product.create(
      productFixture({
        variants: [{ optionValues: [{ name: "Frame Colour", value: "tortoise" }], stock: 1 }],
      })
    );

    const [a, b] = await Promise.all([
      request(app).post("/api/orders").send(orderBody(product._id)),
      request(app).post("/api/orders").send(orderBody(product._id)),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);

    const after = await Product.findById(product._id).lean();
    expect(after.variants[0].stock).toBe(0);
    expect(await Order.countDocuments()).toBe(1);
  });

  test("cancelling an order returns its stock, and only once", async () => {
    const token = await adminToken();
    const product = await Product.create(productFixture());

    const created = await request(app)
      .post("/api/orders")
      .send(orderBody(product._id, { items: [{ productId: product._id, variantId: "tortoise", quantity: 2 }] }));

    const cancel = () =>
      request(app)
        .put(`/api/orders/${created.body._id}/status`)
        .set("Cookie", [`token=${token}`])
        .send({ status: "cancelled" });

    await cancel();
    await cancel();

    const after = await Product.findById(product._id).lean();
    expect(after.variants.find((v) => v.id === "tortoise").stock).toBe(3);
  });
});

describe("the admin order list", () => {
  test("is not reachable without an admin token", async () => {
    const res = await request(app).get("/api/orders");
    expect(res.status).toBe(401);
  });

  test("returns orders newest first, paginated", async () => {
    const token = await adminToken();
    const product = await Product.create(productFixture());
    await request(app).post("/api/orders").send(orderBody(product._id));

    const res = await request(app).get("/api/orders").set("Cookie", [`token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body).toEqual(expect.objectContaining({ total: 1, page: 1, pages: 1 }));
  });

  test("filters by status and searches by customer or order number", async () => {
    const token = await adminToken();
    const product = await Product.create(productFixture());
    const created = await request(app).post("/api/orders").send(orderBody(product._id));

    const byStatus = await request(app)
      .get("/api/orders?status=shipped")
      .set("Cookie", [`token=${token}`]);
    expect(byStatus.body.items).toHaveLength(0);

    const bySearch = await request(app)
      .get(`/api/orders?search=${created.body.orderNumber}`)
      .set("Cookie", [`token=${token}`]);
    expect(bySearch.body.items).toHaveLength(1);
  });

  test("stats report revenue and unfulfilled count, excluding cancellations", async () => {
    const token = await adminToken();
    const product = await Product.create(productFixture({ price: 500 }));
    await request(app).post("/api/orders").send(orderBody(product._id));

    const res = await request(app).get("/api/orders/stats").set("Cookie", [`token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.orders).toBe(1);
    expect(res.body.revenue).toBe(545);
    expect(res.body.averageOrderValue).toBe(545);
    expect(res.body.unfulfilled).toBe(1);
  });

  test("stats do not divide by zero on an empty store", async () => {
    const token = await adminToken();
    const res = await request(app).get("/api/orders/stats").set("Cookie", [`token=${token}`]);
    expect(res.body).toEqual({ orders: 0, revenue: 0, averageOrderValue: 0, unfulfilled: 0 });
  });
});

describe("deleting an order", () => {
  test("a cancelled order can be removed", async () => {
    const token = await adminToken();
    const product = await Product.create(productFixture());
    const created = await request(app).post("/api/orders").send(orderBody(product._id));

    await request(app)
      .put(`/api/orders/${created.body._id}/status`)
      .set("Cookie", [`token=${token}`])
      .send({ status: "cancelled" });

    const res = await request(app)
      .delete(`/api/orders/${created.body._id}`)
      .set("Cookie", [`token=${token}`]);

    expect(res.status).toBe(200);
    expect(await Order.countDocuments()).toBe(0);
  });

  test("a live order cannot be deleted without cancelling it first", async () => {
    const token = await adminToken();
    const product = await Product.create(productFixture());
    const created = await request(app).post("/api/orders").send(orderBody(product._id));

    const res = await request(app)
      .delete(`/api/orders/${created.body._id}`)
      .set("Cookie", [`token=${token}`]);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cancel/i);
    // Still there, and its stock is still held.
    expect(await Order.countDocuments()).toBe(1);
    const after = await Product.findById(product._id).lean();
    expect(after.variants.find((v) => v.id === "tortoise").stock).toBe(2);
  });

  test("requires an admin", async () => {
    const product = await Product.create(productFixture());
    const created = await request(app).post("/api/orders").send(orderBody(product._id));
    const res = await request(app).delete(`/api/orders/${created.body._id}`);
    expect(res.status).toBe(401);
  });
});
