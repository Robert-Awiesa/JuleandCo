const crypto = require("crypto");
const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../app");
const Order = require("../models/Order");
const Product = require("../models/Product");
const { connectTestDB, clearTestDB, closeTestDB } = require("../test/setupTestDb");
const { seedCatalogConfig, productFixture } = require("../test/catalogFixtures");
const { toPesewas, toCedis, signatureIsValid } = require("../utils/paystack");

const SECRET = "sk_test_pretend_key_for_tests";

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret";
  process.env.PAYSTACK_SECRET_KEY = SECRET;
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

const CUSTOMER = { name: "Adjoa M.", email: "adjoa@example.com", phone: "0244000000" };

async function placeOrder(overrides = {}) {
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
      ...overrides,
    });

  return { order: res.body, product };
}

/** A webhook body signed the way Paystack signs one. */
function webhook(payload) {
  const raw = JSON.stringify(payload);
  return {
    raw,
    signature: crypto.createHmac("sha512", SECRET).update(raw).digest("hex"),
  };
}

function chargeSuccess(reference, amountInCedis, extra = {}) {
  return {
    event: "charge.success",
    data: {
      reference,
      status: "success",
      amount: toPesewas(amountInCedis),
      channel: "card",
      ...extra,
    },
  };
}

describe("money is counted in pesewas", () => {
  test("cedis convert to the smallest unit and back", () => {
    // The classic first bug in a Paystack integration is a factor of 100.
    expect(toPesewas(90)).toBe(9000);
    expect(toPesewas(1.5)).toBe(150);
    expect(toCedis(9000)).toBe(90);
  });

  test("fractions do not drift", () => {
    expect(toPesewas(19.99)).toBe(1999);
    expect(toCedis(toPesewas(19.99))).toBe(19.99);
  });
});

describe("the webhook signature", () => {
  test("accepts a body signed with the secret", () => {
    const { raw, signature } = webhook({ event: "charge.success" });
    expect(signatureIsValid(raw, signature)).toBe(true);
  });

  test("rejects a body that was tampered with after signing", () => {
    const { signature } = webhook({ event: "charge.success", data: { amount: 100 } });
    const tampered = JSON.stringify({ event: "charge.success", data: { amount: 999999 } });

    expect(signatureIsValid(tampered, signature)).toBe(false);
  });

  test("rejects a missing signature", () => {
    expect(signatureIsValid("{}", undefined)).toBe(false);
  });

  test("rejects one signed with the wrong secret", () => {
    const raw = JSON.stringify({ event: "charge.success" });
    const forged = crypto.createHmac("sha512", "not-the-secret").update(raw).digest("hex");

    expect(signatureIsValid(raw, forged)).toBe(false);
  });
});

describe("the webhook endpoint", () => {
  test("an unsigned request cannot mark an order paid", async () => {
    const { order } = await placeOrder();

    const res = await request(app)
      .post("/api/payments/webhook")
      .send(chargeSuccess(order.orderNumber, order.totalPrice));

    expect(res.status).toBe(401);
    // Without the signature check this endpoint would be a way for anyone to
    // mark any order paid.
    expect((await Order.findById(order._id)).paymentStatus).toBe("pending");
  });

  test("a forged signature cannot either", async () => {
    const { order } = await placeOrder();
    const { raw } = webhook(chargeSuccess(order.orderNumber, order.totalPrice));

    const res = await request(app)
      .post("/api/payments/webhook")
      .set("Content-Type", "application/json")
      .set("x-paystack-signature", "deadbeef")
      .send(raw);

    expect(res.status).toBe(401);
    expect((await Order.findById(order._id)).paymentStatus).toBe("pending");
  });

  test("a properly signed success marks the order paid", async () => {
    const { order } = await placeOrder();
    const { raw, signature } = webhook(chargeSuccess(order.orderNumber, order.totalPrice));

    const res = await request(app)
      .post("/api/payments/webhook")
      .set("Content-Type", "application/json")
      .set("x-paystack-signature", signature)
      .send(raw);

    expect(res.status).toBe(200);

    const after = await Order.findById(order._id);
    expect(after.paymentStatus).toBe("paid");
    expect(after.paymentReference).toBe(order.orderNumber);
    expect(after.paidAt).toBeTruthy();
  });

  test("paying the wrong amount is refused, not quietly accepted", async () => {
    const { order } = await placeOrder();
    // 500 owed, 1 paid.
    const { raw, signature } = webhook(chargeSuccess(order.orderNumber, 1));

    await request(app)
      .post("/api/payments/webhook")
      .set("Content-Type", "application/json")
      .set("x-paystack-signature", signature)
      .send(raw);

    const after = await Order.findById(order._id);
    // Marking this paid would mean shipping goods for the wrong money.
    expect(after.paymentStatus).toBe("failed");
  });

  test("a repeated webhook does not double-apply", async () => {
    const { order } = await placeOrder();
    const { raw, signature } = webhook(chargeSuccess(order.orderNumber, order.totalPrice));

    const send = () =>
      request(app)
        .post("/api/payments/webhook")
        .set("Content-Type", "application/json")
        .set("x-paystack-signature", signature)
        .send(raw);

    await send();
    const first = await Order.findById(order._id);
    await send();
    const second = await Order.findById(order._id);

    // Paystack retries. Idempotence is not optional.
    expect(second.paymentStatus).toBe("paid");
    expect(second.paidAt.toISOString()).toBe(first.paidAt.toISOString());
  });

  test("the channel Paystack actually used wins over what was chosen", async () => {
    const { order } = await placeOrder();
    const { raw, signature } = webhook(
      chargeSuccess(order.orderNumber, order.totalPrice, { channel: "card" })
    );

    await request(app)
      .post("/api/payments/webhook")
      .set("Content-Type", "application/json")
      .set("x-paystack-signature", signature)
      .send(raw);

    // Chosen mobile money at checkout, paid by card on Paystack.
    expect((await Order.findById(order._id)).paymentMethod).toBe("card");
  });

  test("an event other than charge.success changes nothing", async () => {
    const { order } = await placeOrder();
    const { raw, signature } = webhook({
      event: "charge.failed",
      data: { reference: order.orderNumber, status: "failed", amount: 1 },
    });

    await request(app)
      .post("/api/payments/webhook")
      .set("Content-Type", "application/json")
      .set("x-paystack-signature", signature)
      .send(raw);

    expect((await Order.findById(order._id)).paymentStatus).toBe("pending");
  });
});

describe("starting a payment", () => {
  test("an order that does not exist is a 404", async () => {
    const res = await request(app)
      .post("/api/payments/initialise")
      .send({ orderNumber: "JC-NOTREAL", email: CUSTOMER.email });

    expect(res.status).toBe(404);
  });

  test("the email has to match the order", async () => {
    const { order } = await placeOrder();

    const res = await request(app)
      .post("/api/payments/initialise")
      .send({ orderNumber: order.orderNumber, email: "someone@else.com" });

    // An order number alone is guessable enough that it should not open a
    // payment page carrying someone's name and address.
    expect(res.status).toBe(403);
  });

  test("an order already paid for cannot be paid again", async () => {
    const { order } = await placeOrder();
    await Order.updateOne({ _id: order._id }, { $set: { paymentStatus: "paid" } });

    const res = await request(app)
      .post("/api/payments/initialise")
      .send({ orderNumber: order.orderNumber, email: CUSTOMER.email });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already been paid/i);
  });

  test("a cancelled order cannot be paid for", async () => {
    const { order } = await placeOrder();
    await Order.updateOne({ _id: order._id }, { $set: { status: "cancelled" } });

    const res = await request(app)
      .post("/api/payments/initialise")
      .send({ orderNumber: order.orderNumber, email: CUSTOMER.email });

    expect(res.status).toBe(400);
  });
});

describe("abandoning a payment", () => {
  test("returns the stock that was held", async () => {
    const { order, product } = await placeOrder();

    const before = await Product.findById(product._id);
    expect(before.variants.find((v) => v.id === "tortoise").stock).toBe(2);

    await request(app)
      .post("/api/payments/abandon")
      .send({ orderNumber: order.orderNumber, email: CUSTOMER.email });

    const after = await Product.findById(product._id);
    // Walking away from the payment page must not keep a piece off the shop.
    expect(after.variants.find((v) => v.id === "tortoise").stock).toBe(3);
    expect((await Order.findById(order._id)).status).toBe("cancelled");
  });

  test("a paid order cannot be abandoned", async () => {
    const { order } = await placeOrder();
    await Order.updateOne({ _id: order._id }, { $set: { paymentStatus: "paid" } });

    const res = await request(app)
      .post("/api/payments/abandon")
      .send({ orderNumber: order.orderNumber, email: CUSTOMER.email });

    expect(res.status).toBe(400);
  });

  test("the email has to match", async () => {
    const { order } = await placeOrder();

    const res = await request(app)
      .post("/api/payments/abandon")
      .send({ orderNumber: order.orderNumber, email: "someone@else.com" });

    expect(res.status).toBe(403);
  });
});
