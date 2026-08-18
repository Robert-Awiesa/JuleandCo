const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../app");
const { connectTestDB, clearTestDB, closeTestDB } = require("./setupTestDb");

const PingSchema = new mongoose.Schema({ value: String });
const Ping = mongoose.model("Ping", PingSchema);

beforeAll(async () => {
  await connectTestDB();
});

afterEach(async () => {
  await clearTestDB();
});

afterAll(async () => {
  await closeTestDB();
});

test("health check responds ok", async () => {
  const res = await request(app).get("/api/health");
  expect(res.status).toBe(200);
  expect(res.body.status).toBe("ok");
});

test("can insert and read a document from the in-memory database", async () => {
  await Ping.create({ value: "pong" });
  const found = await Ping.findOne({ value: "pong" });
  expect(found.value).toBe("pong");
});
