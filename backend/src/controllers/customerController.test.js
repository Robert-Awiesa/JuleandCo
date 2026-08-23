const mongoose = require("mongoose");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../app");
const Order = require("../models/Order");
const User = require("../models/User");
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

let counter = 0;

/** An order as the checkout writes one, without going through pricing. */
async function placeOrder({ email, name = "Adjoa M.", total = 100, status = "pending", quantity = 1 }) {
  counter += 1;
  return Order.create({
    orderNumber: `JC-TEST${counter}`,
    customer: { name, email, phone: "0244000000" },
    // A real id: order lines reference the product they were bought from.
    items: [{ product: new mongoose.Types.ObjectId(), name: "A piece", price: total, quantity }],
    shippingAddress: {
      fullName: name,
      phone: "0244000000",
      address: "12 Oxford Street",
      city: "Accra",
      region: "Greater Accra",
    },
    paymentMethod: "mobile_money",
    itemsPrice: total,
    totalPrice: total,
    status,
  });
}

describe("the customer list", () => {
  test("is not reachable without an admin token", async () => {
    const res = await request(app).get("/api/customers");
    expect(res.status).toBe(401);
  });

  test("groups a buyer's orders into one row", async () => {
    const token = await adminToken();
    await placeOrder({ email: "adjoa@example.com", total: 100 });
    await placeOrder({ email: "adjoa@example.com", total: 250 });

    const res = await asAdmin(request(app).get("/api/customers"), token);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toEqual(
      expect.objectContaining({ email: "adjoa@example.com", orders: 2, spent: 350 })
    );
  });

  test("email is the identity, not the name someone typed", async () => {
    const token = await adminToken();
    await placeOrder({ email: "adjoa@example.com", name: "Adjoa M." });
    await placeOrder({ email: "adjoa@example.com", name: "adjoa m" });

    const res = await asAdmin(request(app).get("/api/customers"), token);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].orders).toBe(2);
  });

  test("a cancelled order counts as history, not as spend", async () => {
    const token = await adminToken();
    await placeOrder({ email: "kwame@example.com", total: 500 });
    await placeOrder({ email: "kwame@example.com", total: 900, status: "cancelled" });

    const res = await asAdmin(request(app).get("/api/customers"), token);
    const kwame = res.body.items.find((c) => c.email === "kwame@example.com");

    expect(kwame.orders).toBe(2);
    expect(kwame.cancelled).toBe(1);
    expect(kwame.spent).toBe(500);
  });

  test("the best customers come first", async () => {
    const token = await adminToken();
    await placeOrder({ email: "small@example.com", total: 50 });
    await placeOrder({ email: "big@example.com", total: 5000 });

    const res = await asAdmin(request(app).get("/api/customers"), token);
    expect(res.body.items[0].email).toBe("big@example.com");
  });

  test("searches by name, email or phone", async () => {
    const token = await adminToken();
    await placeOrder({ email: "adjoa@example.com", name: "Adjoa M." });
    await placeOrder({ email: "kwame@example.com", name: "Kwame B." });

    const byName = await asAdmin(request(app).get("/api/customers?search=adjo"), token);
    expect(byName.body.items).toHaveLength(1);

    const byEmail = await asAdmin(request(app).get("/api/customers?search=kwame@"), token);
    expect(byEmail.body.items).toHaveLength(1);
  });

  test("an empty shop reports no customers rather than failing", async () => {
    const token = await adminToken();
    const res = await asAdmin(request(app).get("/api/customers"), token);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], total: 0, page: 1, pages: 1 });
  });
});

describe("one customer", () => {
  test("comes back with every order they placed, newest first", async () => {
    const token = await adminToken();
    await placeOrder({ email: "adjoa@example.com", total: 100 });
    await placeOrder({ email: "adjoa@example.com", total: 250 });

    const res = await asAdmin(request(app).get("/api/customers/adjoa@example.com"), token);

    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(2);
    expect(res.body.summary).toEqual(expect.objectContaining({ orders: 2, spent: 350 }));
  });

  test("an address nobody has ordered from is a 404", async () => {
    const token = await adminToken();
    const res = await asAdmin(request(app).get("/api/customers/nobody@example.com"), token);
    expect(res.status).toBe(404);
  });
});

describe("customer figures", () => {
  test("counts who came back, which is the number worth watching", async () => {
    const token = await adminToken();
    await placeOrder({ email: "loyal@example.com", total: 100 });
    await placeOrder({ email: "loyal@example.com", total: 100 });
    await placeOrder({ email: "once@example.com", total: 200 });

    const res = await asAdmin(request(app).get("/api/customers/stats"), token);

    expect(res.body.customers).toBe(2);
    expect(res.body.returning).toBe(1);
    expect(res.body.averageSpend).toBe(200);
  });

  test("does not divide by zero on an empty shop", async () => {
    const token = await adminToken();
    const res = await asAdmin(request(app).get("/api/customers/stats"), token);
    expect(res.body).toEqual({ customers: 0, returning: 0, averageSpend: 0 });
  });
});
