const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../app");
const User = require("../models/User");
const Subscriber = require("../models/Subscriber");
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

const join = (email, source) =>
  request(app).post("/api/subscribers").send({ email, source });

describe("joining the mailing list", () => {
  test("an address is actually stored", async () => {
    // The footer form used to answer "Thanks!" and discard it, so this is the
    // whole point of the endpoint existing.
    const res = await join("adjoa@example.com");

    expect(res.status).toBe(201);
    expect(await Subscriber.countDocuments()).toBe(1);
    expect((await Subscriber.findOne()).email).toBe("adjoa@example.com");
  });

  test("the address is stored lowercased and trimmed", async () => {
    await join("  Adjoa@Example.COM  ");
    expect((await Subscriber.findOne()).email).toBe("adjoa@example.com");
  });

  test("signing up twice is not an error and does not duplicate", async () => {
    await join("adjoa@example.com");
    const second = await join("adjoa@example.com");

    // Someone who cannot remember whether they joined will simply do it again.
    // Telling them "already subscribed" is unhelpful, and confirms to a
    // stranger which addresses are on the list.
    expect(second.status).toBe(201);
    expect(await Subscriber.countDocuments()).toBe(1);
  });

  test("something that is not an email is refused", async () => {
    const res = await join("not-an-email");

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/email address/i);
    expect(await Subscriber.countDocuments()).toBe(0);
  });

  test("a missing address is refused rather than stored empty", async () => {
    const res = await request(app).post("/api/subscribers").send({});

    expect(res.status).toBe(400);
    expect(await Subscriber.countDocuments()).toBe(0);
  });

  test("where the signup came from is recorded", async () => {
    await join("adjoa@example.com", "footer");
    expect((await Subscriber.findOne()).source).toBe("footer");
  });
});

describe("the list itself", () => {
  test("is admin-only", async () => {
    const res = await request(app).get("/api/subscribers");
    expect(res.status).toBe(401);
  });

  test("is readable by an admin, newest first", async () => {
    const token = await adminToken();
    await join("first@example.com");
    await join("second@example.com");

    const res = await request(app)
      .get("/api/subscribers")
      .set("Cookie", [`token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items[0].email).toBe("second@example.com");
  });

  test("someone removed stops appearing but is not deleted", async () => {
    const token = await adminToken();
    await join("adjoa@example.com");
    const { _id } = await Subscriber.findOne();

    await request(app)
      .delete(`/api/subscribers/${_id}`)
      .set("Cookie", [`token=${token}`]);

    const res = await request(app)
      .get("/api/subscribers")
      .set("Cookie", [`token=${token}`]);

    expect(res.body.total).toBe(0);
    // Deleting the row outright would let the next form submission re-add them
    // and start the mail again. The record is what makes "no" stick.
    expect(await Subscriber.countDocuments()).toBe(1);
    expect((await Subscriber.findById(_id)).unsubscribedAt).toBeTruthy();
  });

  test("someone who unsubscribed can deliberately rejoin", async () => {
    const token = await adminToken();
    await join("adjoa@example.com");
    const { _id } = await Subscriber.findOne();
    await request(app).delete(`/api/subscribers/${_id}`).set("Cookie", [`token=${token}`]);

    await join("adjoa@example.com");

    const res = await request(app)
      .get("/api/subscribers")
      .set("Cookie", [`token=${token}`]);

    // A second deliberate signup is a request to hear from us again.
    expect(res.body.total).toBe(1);
  });

  test("removing someone who is not on it is a 404", async () => {
    const token = await adminToken();
    const res = await request(app)
      .delete("/api/subscribers/60f7c0c4b4d1c80015a1b2c3")
      .set("Cookie", [`token=${token}`]);

    expect(res.status).toBe(404);
  });
});
