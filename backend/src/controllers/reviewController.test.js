const mongoose = require("mongoose");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../app");
const Review = require("../models/Review");
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

const REVIEW = {
  author: "Adjoa M.",
  email: "adjoa@example.com",
  rating: 5,
  title: "Beautiful",
  body: "Exactly as described, and it arrived quickly.",
};

async function publishedProduct() {
  return Product.create(productFixture({ publishStatus: "published" }));
}

describe("leaving a review", () => {
  test("anyone can leave one without an account", async () => {
    const product = await publishedProduct();

    const res = await request(app).post(`/api/products/${product._id}/reviews`).send(REVIEW);

    expect(res.status).toBe(201);
    expect(await Review.countDocuments()).toBe(1);
  });

  test("it is held for reading rather than published straight away", async () => {
    const product = await publishedProduct();
    await request(app).post(`/api/products/${product._id}/reviews`).send(REVIEW);

    const stored = await Review.findOne();
    expect(stored.status).toBe("pending");

    // Nothing on the product page yet.
    const publicList = await request(app).get(`/api/products/${product._id}/reviews`);
    expect(publicList.body).toHaveLength(0);
  });

  test("a rating outside 1–5 is refused", async () => {
    const product = await publishedProduct();

    const res = await request(app)
      .post(`/api/products/${product._id}/reviews`)
      .send({ ...REVIEW, rating: 9 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/between 1 and 5/i);
  });

  test("the same person cannot review the same piece twice", async () => {
    const product = await publishedProduct();
    await request(app).post(`/api/products/${product._id}/reviews`).send(REVIEW);

    const second = await request(app).post(`/api/products/${product._id}/reviews`).send(REVIEW);

    expect(second.status).toBe(400);
    expect(await Review.countDocuments()).toBe(1);
  });

  test("a draft product cannot be reviewed", async () => {
    const product = await Product.create(productFixture({ publishStatus: "draft" }));
    const res = await request(app).post(`/api/products/${product._id}/reviews`).send(REVIEW);
    expect(res.status).toBe(404);
  });

  test("someone who bought the piece is marked as a verified purchase", async () => {
    const product = await publishedProduct();
    await Order.create({
      orderNumber: "JC-VERIFY1",
      customer: { name: "Adjoa M.", email: "adjoa@example.com", phone: "0244000000" },
      items: [{ product: product._id, name: product.name, price: 100, quantity: 1 }],
      shippingAddress: {
        fullName: "Adjoa M.",
        phone: "0244000000",
        address: "12 Oxford Street",
        city: "Accra",
        region: "Greater Accra",
      },
      paymentMethod: "mobile_money",
      itemsPrice: 100,
      totalPrice: 100,
    });

    await request(app).post(`/api/products/${product._id}/reviews`).send(REVIEW);

    expect((await Review.findOne()).verifiedPurchase).toBe(true);
  });

  test("someone who did not buy it is not", async () => {
    const product = await publishedProduct();
    await request(app).post(`/api/products/${product._id}/reviews`).send(REVIEW);
    expect((await Review.findOne()).verifiedPurchase).toBe(false);
  });

  test("a cancelled order does not count as a purchase", async () => {
    const product = await publishedProduct();
    await Order.create({
      orderNumber: "JC-VERIFY2",
      customer: { name: "Adjoa M.", email: "adjoa@example.com", phone: "0244000000" },
      items: [{ product: product._id, name: product.name, price: 100, quantity: 1 }],
      shippingAddress: {
        fullName: "Adjoa M.",
        phone: "0244000000",
        address: "12 Oxford Street",
        city: "Accra",
        region: "Greater Accra",
      },
      paymentMethod: "mobile_money",
      itemsPrice: 100,
      totalPrice: 100,
      status: "cancelled",
    });

    await request(app).post(`/api/products/${product._id}/reviews`).send(REVIEW);
    expect((await Review.findOne()).verifiedPurchase).toBe(false);
  });
});

describe("moderation", () => {
  test("an approved review appears publicly, without the email", async () => {
    const token = await adminToken();
    const product = await publishedProduct();
    await request(app).post(`/api/products/${product._id}/reviews`).send(REVIEW);
    const review = await Review.findOne();

    await asAdmin(request(app).patch(`/api/reviews/${review._id}`), token).send({
      status: "approved",
    });

    const res = await request(app).get(`/api/products/${product._id}/reviews`);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].author).toBe("Adjoa M.");
    expect(res.body[0].email).toBeUndefined();
  });

  test("a rejected one stays hidden", async () => {
    const token = await adminToken();
    const product = await publishedProduct();
    await request(app).post(`/api/products/${product._id}/reviews`).send(REVIEW);
    const review = await Review.findOne();

    await asAdmin(request(app).patch(`/api/reviews/${review._id}`), token).send({
      status: "rejected",
    });

    const res = await request(app).get(`/api/products/${product._id}/reviews`);
    expect(res.body).toHaveLength(0);
  });

  test("moderating needs an admin", async () => {
    const product = await publishedProduct();
    await request(app).post(`/api/products/${product._id}/reviews`).send(REVIEW);
    const review = await Review.findOne();

    const res = await request(app).patch(`/api/reviews/${review._id}`).send({ status: "approved" });
    expect(res.status).toBe(401);
  });

  test("the queue counts what is still waiting", async () => {
    const token = await adminToken();
    const product = await publishedProduct();
    await request(app).post(`/api/products/${product._id}/reviews`).send(REVIEW);

    const res = await asAdmin(request(app).get("/api/reviews"), token);
    expect(res.body.pending).toBe(1);
    expect(res.body.items[0].product.name).toBe(product.name);
  });
});

describe("the product's score", () => {
  async function review(productId, email, rating) {
    return Review.create({
      product: productId,
      author: email,
      email,
      rating,
      body: "A review.",
      status: "approved",
    });
  }

  test("is the average of approved reviews, not a number anyone set", async () => {
    const token = await adminToken();
    const product = await publishedProduct();

    await review(product._id, "a@example.com", 5);
    await review(product._id, "b@example.com", 4);

    // Moderating anything recomputes the score.
    const third = await Review.create({
      product: product._id,
      author: "c",
      email: "c@example.com",
      rating: 3,
      body: "A review.",
    });
    await asAdmin(request(app).patch(`/api/reviews/${third._id}`), token).send({
      status: "approved",
    });

    const after = await Product.findById(product._id);
    expect(after.reviewCount).toBe(3);
    expect(after.rating).toBe(4);
  });

  test("a pending review counts for nothing", async () => {
    const token = await adminToken();
    const product = await publishedProduct();

    await review(product._id, "a@example.com", 5);
    const pending = await Review.create({
      product: product._id,
      author: "b",
      email: "b@example.com",
      rating: 1,
      body: "A review.",
    });

    // Approve then unapprove, to force a recompute either way.
    await asAdmin(request(app).patch(`/api/reviews/${pending._id}`), token).send({
      status: "approved",
    });
    await asAdmin(request(app).patch(`/api/reviews/${pending._id}`), token).send({
      status: "pending",
    });

    const after = await Product.findById(product._id);
    expect(after.reviewCount).toBe(1);
    expect(after.rating).toBe(5);
  });

  test("no reviews means no rating, not a rating of nought", async () => {
    const token = await adminToken();
    const product = await publishedProduct();

    const only = await review(product._id, "a@example.com", 5);
    const res = await asAdmin(request(app).delete(`/api/reviews/${only._id}`), token);
    expect(res.status).toBe(200);

    const after = await Product.findById(product._id);
    expect(after.reviewCount).toBe(0);
    // Null, not 0 — a shop with no reviews has not been rated nought out of five.
    expect(after.rating ?? null).toBeNull();
  });

  test("deleting a review takes it off the product", async () => {
    const token = await adminToken();
    const product = await publishedProduct();

    const a = await review(product._id, "a@example.com", 5);
    await review(product._id, "b@example.com", 1);
    await asAdmin(request(app).delete(`/api/reviews/${a._id}`), token);

    const after = await Product.findById(product._id);
    expect(after.reviewCount).toBe(1);
    expect(after.rating).toBe(1);
  });
});
