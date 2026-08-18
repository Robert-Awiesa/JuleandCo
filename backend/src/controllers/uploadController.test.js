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

test("returns a valid Cloudinary upload signature", async () => {
  const token = await adminToken();

  const res = await request(app)
    .post("/api/uploads/sign")
    .set("Cookie", [`token=${token}`])
    .send({ folder: "jules-and-co/test" });

  expect(res.status).toBe(200);
  expect(res.body.folder).toBe("jules-and-co/test");
  expect(res.body.cloudName).toBe("test-cloud");

  const expectedSignature = cloudinary.utils.api_sign_request(
    { timestamp: res.body.timestamp, folder: res.body.folder },
    process.env.CLOUDINARY_API_SECRET
  );
  expect(res.body.signature).toBe(expectedSignature);
});

test("rejects unauthenticated requests", async () => {
  const res = await request(app).post("/api/uploads/sign").send({});
  expect(res.status).toBe(401);
});
