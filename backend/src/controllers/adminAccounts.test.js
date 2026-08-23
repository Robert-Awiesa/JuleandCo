const request = require("supertest");
const jwt = require("jsonwebtoken");
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

async function makeAdmin(email = "admin@test.com") {
  const admin = await User.create({
    name: "Admin",
    email,
    password: "password123",
    role: "admin",
  });
  return { admin, token: jwt.sign({ id: admin._id, role: "admin" }, process.env.JWT_SECRET) };
}

const asAdmin = (req, token) => req.set("Cookie", [`token=${token}`]);

describe("administrator accounts", () => {
  test("are listed without exposing password hashes", async () => {
    const { token } = await makeAdmin();

    const res = await asAdmin(request(app).get("/api/auth/admins"), token);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].password).toBeUndefined();
  });

  test("a second administrator can be added", async () => {
    const { token } = await makeAdmin();

    const res = await asAdmin(request(app).post("/api/auth/admins"), token).send({
      name: "Second Admin",
      email: "second@test.com",
      password: "password123",
    });

    expect(res.status).toBe(201);
    expect(await User.countDocuments({ role: "admin" })).toBe(2);
  });

  test("a short password is refused", async () => {
    const { token } = await makeAdmin();

    const res = await asAdmin(request(app).post("/api/auth/admins"), token).send({
      name: "Weak",
      email: "weak@test.com",
      password: "short",
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/8 characters/);
  });

  test("an existing customer is promoted rather than duplicated", async () => {
    const { token } = await makeAdmin();
    await User.create({ name: "Adjoa", email: "adjoa@test.com", password: "password123" });

    const res = await asAdmin(request(app).post("/api/auth/admins"), token).send({
      name: "Adjoa",
      email: "adjoa@test.com",
      password: "password123",
    });

    expect(res.status).toBe(200);
    // One account, not two — a second would split their history.
    expect(await User.countDocuments({ email: "adjoa@test.com" })).toBe(1);
    expect((await User.findOne({ email: "adjoa@test.com" })).role).toBe("admin");
  });

  test("the last administrator cannot be removed", async () => {
    const { admin, token } = await makeAdmin();
    const other = await User.create({
      name: "Other",
      email: "other@test.com",
      password: "password123",
      role: "admin",
    });

    // Remove the second one, leaving only the caller.
    await asAdmin(request(app).delete(`/api/auth/admins/${other._id}`), token);

    // Now there is one, and it is the caller — refused twice over.
    const res = await asAdmin(request(app).delete(`/api/auth/admins/${admin._id}`), token);
    expect(res.status).toBe(400);
    expect(await User.countDocuments({ role: "admin" })).toBe(1);
  });

  test("nobody can remove their own access", async () => {
    const { admin, token } = await makeAdmin();
    await User.create({
      name: "Other",
      email: "other@test.com",
      password: "password123",
      role: "admin",
    });

    const res = await asAdmin(request(app).delete(`/api/auth/admins/${admin._id}`), token);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/your own access/i);
  });

  test("removing demotes rather than deletes, so their orders survive", async () => {
    const { token } = await makeAdmin();
    const other = await User.create({
      name: "Other",
      email: "other@test.com",
      password: "password123",
      role: "admin",
    });

    const res = await asAdmin(request(app).delete(`/api/auth/admins/${other._id}`), token);

    expect(res.status).toBe(200);
    const after = await User.findById(other._id);
    expect(after).not.toBeNull();
    expect(after.role).toBe("customer");
  });

  test("managing administrators needs an admin", async () => {
    const res = await request(app).get("/api/auth/admins");
    expect(res.status).toBe(401);
  });
});

describe("changing your own password", () => {
  test("works, and the new password logs you in", async () => {
    const { token } = await makeAdmin();

    const changed = await asAdmin(request(app).put("/api/auth/password"), token).send({
      currentPassword: "password123",
      newPassword: "a-much-better-password",
    });
    expect(changed.status).toBe(200);

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@test.com", password: "a-much-better-password" });
    expect(login.status).toBe(200);
  });

  test("the current password has to be right", async () => {
    const { token } = await makeAdmin();

    const res = await asAdmin(request(app).put("/api/auth/password"), token).send({
      currentPassword: "not-it",
      newPassword: "a-much-better-password",
    });

    expect(res.status).toBe(401);
  });

  test("a short new password is refused", async () => {
    const { token } = await makeAdmin();

    const res = await asAdmin(request(app).put("/api/auth/password"), token).send({
      currentPassword: "password123",
      newPassword: "short",
    });

    expect(res.status).toBe(400);
  });
});
