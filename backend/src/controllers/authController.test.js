const request = require("supertest");
const app = require("../app");
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

test("login sets an httpOnly cookie and returns the role", async () => {
  await User.create({
    name: "Admin",
    email: "admin@test.com",
    password: "password123",
    role: "admin",
  });

  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: "admin@test.com", password: "password123" });

  expect(res.status).toBe(200);
  expect(res.body.role).toBe("admin");
  const setCookie = res.headers["set-cookie"][0];
  expect(setCookie).toMatch(/token=/);
  expect(setCookie).toMatch(/HttpOnly/i);
});

test("protect middleware accepts a token from a cookie", async () => {
  await User.create({
    name: "Admin",
    email: "admin@test.com",
    password: "password123",
    role: "admin",
  });
  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ email: "admin@test.com", password: "password123" });
  const cookie = loginRes.headers["set-cookie"][0].split(";")[0];

  const meRes = await request(app).get("/api/auth/me").set("Cookie", [cookie]);
  expect(meRes.status).toBe(200);
  expect(meRes.body.email).toBe("admin@test.com");
});

test("logout clears the cookie", async () => {
  const res = await request(app).post("/api/auth/logout");
  expect(res.status).toBe(200);
  expect(res.headers["set-cookie"][0]).toMatch(/token=;/);
});
