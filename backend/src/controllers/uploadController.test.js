const request = require("supertest");
const jwt = require("jsonwebtoken");
const cloudinary = require("../config/cloudinary");
const app = require("../app");
const User = require("../models/User");
const { connectTestDB, clearTestDB, closeTestDB } = require("../test/setupTestDb");

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret";
  process.env.CLOUDINARY_API_KEY = "test-key";
  process.env.CLOUDINARY_API_SECRET = "test-api-secret";
  process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
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

const sign = (token, body = {}) =>
  request(app).post("/api/uploads/sign").set("Cookie", [`token=${token}`]).send(body);

/**
 * The API only ever signs. The file itself goes straight from the browser to
 * Cloudinary and never passes through this process — which is what keeps
 * uploads working on a serverless deployment, where a request body is capped
 * well below the size of an ordinary photograph.
 */
test("returns a signature Cloudinary will accept", async () => {
  const token = await adminToken();

  const res = await sign(token, { folder: "products" });

  expect(res.status).toBe(200);
  expect(res.body.cloudName).toBe("test-cloud");
  expect(res.body.folder).toBe("jules-and-co/products");

  const expected = cloudinary.utils.api_sign_request(
    { timestamp: res.body.timestamp, folder: res.body.folder },
    process.env.CLOUDINARY_API_SECRET
  );
  expect(res.body.signature).toBe(expected);
});

describe("which library an upload goes to", () => {
  test("site imagery is kept apart from product shots", async () => {
    const token = await adminToken();

    // Sharing one folder put hero banners in the product form's "Reuse a
    // shot" picker, which is the wrong library to be choosing from.
    const res = await sign(token, { folder: "content" });
    expect(res.body.folder).toBe("jules-and-co/content");
  });

  test("no folder means products", async () => {
    const token = await adminToken();
    const res = await sign(token, {});
    expect(res.body.folder).toBe("jules-and-co/products");
  });

  test("an unknown folder falls back rather than creating one", async () => {
    const token = await adminToken();

    // Accepting whatever arrives would scatter stray folders through
    // Cloudinary that nothing ever cleans up.
    for (const folder of ["../../elsewhere", "products/../secret", "typo", ""]) {
      const res = await sign(token, { folder });
      expect(res.body.folder).toBe("jules-and-co/products");
    }
  });

  test("the signature always covers the folder actually used", async () => {
    const token = await adminToken();

    // Signing one folder and uploading to another is refused by Cloudinary, so
    // these two must never drift apart.
    const res = await sign(token, { folder: "content" });
    const expected = cloudinary.utils.api_sign_request(
      { timestamp: res.body.timestamp, folder: "jules-and-co/content" },
      process.env.CLOUDINARY_API_SECRET
    );
    expect(res.body.signature).toBe(expected);
  });
});

test("rejects unauthenticated requests", async () => {
  const res = await request(app).post("/api/uploads/sign").send({});
  expect(res.status).toBe(401);
});

test("the recent-uploads picker is admin-only", async () => {
  const res = await request(app).get("/api/uploads/recent");
  expect(res.status).toBe(401);
});
