const mongoose = require("mongoose");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../app");
const Order = require("../models/Order");
const User = require("../models/User");
const { connectTestDB, clearTestDB, closeTestDB } = require("../test/setupTestDb");
const { EMAILS, sendOrderEmail, deliveryLine, optionText } = require("./orderEmails");
const mailer = require("./mailer");

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret";
  await connectTestDB();
});
afterEach(async () => {
  await clearTestDB();
  jest.restoreAllMocks();
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

let counter = 0;
async function makeOrder(overrides = {}) {
  counter += 1;
  return Order.create({
    orderNumber: `JC-MAIL${counter}`,
    customer: { name: "Adjoa M.", email: "adjoa@example.com", phone: "0244000000" },
    items: [
      {
        product: new mongoose.Types.ObjectId(),
        name: "The Aviator",
        price: 890,
        quantity: 1,
        options: { "Frame Colour": "Tortoise" },
      },
    ],
    shippingAddress: {
      fullName: "Adjoa M.",
      phone: "0244000000",
      address: "12 Oxford Street",
      city: "Accra",
      region: "Greater Accra",
    },
    paymentMethod: "mobile_money",
    itemsPrice: 890,
    totalPrice: 890,
    ...overrides,
  });
}

/** Intercepts the send so no test ever mails a real address. */
function captureSends() {
  const sent = [];
  jest.spyOn(mailer, "sendEmail").mockImplementation(async (message) => {
    sent.push(message);
    return { sent: true, id: `test-${sent.length}` };
  });
  return sent;
}

describe("what the customer is told", () => {
  test("there is an email for every moment in an order's life", () => {
    // The four the owner asked for, plus cancellation: cancelling an order
    // someone paid for and saying nothing is the worst thing this shop could do.
    expect(Object.keys(EMAILS).sort()).toEqual(
      ["cancelled", "delivered", "paid", "processing", "shipped"].sort()
    );
  });

  test("the receipt names the piece, the options and the total", async () => {
    const sent = captureSends();
    const order = await makeOrder();

    await sendOrderEmail(order, "paid");

    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toContain(order.orderNumber);
    expect(sent[0].html).toContain("The Aviator");
    expect(sent[0].html).toContain("Tortoise");
    expect(sent[0].text).toContain("890");
  });

  test("every email carries a plain-text body as well as HTML", async () => {
    const sent = captureSends();
    const order = await makeOrder();

    for (const event of Object.keys(EMAILS)) {
      order.notifications = [];
      await sendOrderEmail(order, event);
    }

    // HTML-only mail renders as nothing in some clients and reads as spam to
    // some filters. An unreadable order confirmation is worse than a plain one.
    expect(sent).toHaveLength(5);
    sent.forEach((message) => {
      expect(message.text.length).toBeGreaterThan(50);
      expect(message.html).toContain("<");
    });
  });

  test("the shipped email carries the tracking reference when there is one", async () => {
    const sent = captureSends();
    const order = await makeOrder({ trackingNumber: "GH-1234-5678" });

    await sendOrderEmail(order, "shipped");
    expect(sent[0].html).toContain("GH-1234-5678");
  });

  test("a cancelled order that was paid for mentions the refund", async () => {
    const sent = captureSends();
    const order = await makeOrder({ paymentStatus: "paid" });

    await sendOrderEmail(order, "cancelled");
    expect(sent[0].text.toLowerCase()).toContain("refund");
  });

  test("a cancelled order that was never paid says nothing was charged", async () => {
    const sent = captureSends();
    const order = await makeOrder({ paymentStatus: "pending" });

    await sendOrderEmail(order, "cancelled");
    expect(sent[0].text.toLowerCase()).toContain("nothing has been charged");
  });
});

describe("nothing internal reaches the customer", () => {
  /**
   * The order is **read back from the database**, which is the whole point.
   *
   * `options` and `selections` are Mongoose Map paths. A freshly created
   * document still holds a plain object; one loaded from Mongo holds a real Map,
   * and `Object.values()` on that returns the document's own internals. That is
   * how a customer's receipt came to print
   * `{ product: new ObjectId(...), image: '...' } / options / [object Object]`.
   *
   * Every earlier test here used the in-memory document and so could not see it.
   */
  test("a receipt built from a stored order names the option, not the document", async () => {
    const sent = captureSends();
    const created = await makeOrder();
    const order = await Order.findById(created._id);

    await sendOrderEmail(order, "paid");

    const { html, text } = sent[0];

    expect(html).toContain("Frame Colour: Tortoise");
    expect(text).toContain("Frame Colour: Tortoise");

    for (const leak of ["ObjectId", "[object Object]", "cloudinary", "picsum", "variantId", "_id"]) {
      expect(html).not.toContain(leak);
      expect(text).not.toContain(leak);
    }
  });

  test("options are labelled, so two values cannot be confused", async () => {
    const created = await makeOrder({
      items: [
        {
          product: new mongoose.Types.ObjectId(),
          name: "The Coastal",
          price: 760,
          quantity: 1,
          options: { "Frame Colour": "Sage" },
          selections: { Lens: "Sage Tint" },
        },
      ],
    });
    const order = await Order.findById(created._id);

    // "Sage · Sage Tint" would not tell anyone which is the frame and which is
    // the lens.
    expect(optionText(order.items[0])).toBe("Frame Colour: Sage · Lens: Sage Tint");
  });

  test("a line with no options renders no empty detail row", async () => {
    const created = await makeOrder({
      items: [
        {
          product: new mongoose.Types.ObjectId(),
          name: "Plain Piece",
          price: 100,
          quantity: 1,
        },
      ],
    });
    const order = await Order.findById(created._id);

    expect(optionText(order.items[0])).toBe("");
  });

  test("the address is shown so the customer can check it", async () => {
    const sent = captureSends();
    const created = await makeOrder();
    const order = await Order.findById(created._id);

    await sendOrderEmail(order, "paid");

    expect(sent[0].html).toContain("12 Oxford Street");
    expect(sent[0].text).toContain("Accra");
  });
});

describe("delivery is described honestly", () => {
  test("an unagreed charge does not imply a figure", async () => {
    const order = await makeOrder({ shippingPrice: null });
    expect(deliveryLine(order)).toMatch(/arranged with you/i);
  });

  test("an agreed charge of nothing is stated as such", async () => {
    const order = await makeOrder({ shippingPrice: 0 });
    expect(deliveryLine(order)).toMatch(/no charge/i);
  });

  test("an agreed charge is shown", async () => {
    const order = await makeOrder({ shippingPrice: 75 });
    expect(deliveryLine(order)).toContain("75");
  });
});

describe("nobody is told the same thing twice", () => {
  test("a repeated send is skipped", async () => {
    const sent = captureSends();
    const order = await makeOrder();

    await sendOrderEmail(order, "paid");
    const second = await sendOrderEmail(order, "paid");

    expect(sent).toHaveLength(1);
    expect(second.reason).toBe("already sent");
  });

  test("what was sent is recorded on the order", async () => {
    captureSends();
    const order = await makeOrder();

    await sendOrderEmail(order, "paid");

    const stored = await Order.findById(order._id);
    expect(stored.notifications.map((n) => n.event)).toEqual(["paid"]);
    expect(stored.notifications[0].sentAt).toBeTruthy();
  });
});

describe("sending is never allowed to break an order", () => {
  test("an unconfigured mailer reports why rather than throwing", async () => {
    const key = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;

    const order = await makeOrder();
    const result = await sendOrderEmail(order, "paid");

    expect(result.sent).toBe(false);
    expect(result.reason).toMatch(/RESEND_API_KEY/);
    // Nothing recorded, so it will be sent once the key is configured.
    expect((await Order.findById(order._id)).notifications).toHaveLength(0);

    if (key) process.env.RESEND_API_KEY = key;
  });

  test("a provider failure does not stop the admin advancing an order", async () => {
    const token = await adminToken();
    const order = await makeOrder();

    jest.spyOn(mailer, "sendEmail").mockRejectedValue(new Error("Resend is down"));

    const res = await request(app)
      .put(`/api/orders/${order._id}/status`)
      .set("Cookie", [`token=${token}`])
      .send({ status: "processing" });

    // The shop must keep working when a mail provider does not.
    expect(res.status).toBe(200);
    expect((await Order.findById(order._id)).status).toBe("processing");
  });
});

describe("status changes trigger the right email", () => {
  test("advancing an order emails the customer once", async () => {
    const sent = captureSends();
    const token = await adminToken();
    const order = await makeOrder();

    const advance = (status) =>
      request(app)
        .put(`/api/orders/${order._id}/status`)
        .set("Cookie", [`token=${token}`])
        .send({ status });

    await advance("processing");
    await advance("shipped");
    await advance("delivered");

    expect(sent.map((m) => m.subject)).toEqual([
      expect.stringContaining("confirmed"),
      expect.stringContaining("on its way"),
      expect.stringContaining("delivered"),
    ]);
  });

  test("re-saving an order without changing status sends nothing", async () => {
    const sent = captureSends();
    const token = await adminToken();
    const order = await makeOrder();

    // Agreeing the delivery charge is not a status change and must not
    // re-announce anything.
    await request(app)
      .put(`/api/orders/${order._id}/status`)
      .set("Cookie", [`token=${token}`])
      .send({ shippingPrice: 75 });

    expect(sent).toHaveLength(0);
  });

  test("setting the same status again sends nothing", async () => {
    const sent = captureSends();
    const token = await adminToken();
    const order = await makeOrder({ status: "processing" });

    await request(app)
      .put(`/api/orders/${order._id}/status`)
      .set("Cookie", [`token=${token}`])
      .send({ status: "processing" });

    expect(sent).toHaveLength(0);
  });
});
