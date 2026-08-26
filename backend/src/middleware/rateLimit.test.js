/**
 * These run against a *forced* limiter.
 *
 * Rate limits are production-only, so the rest of the suite is unthrottled.
 * That makes it entirely possible for them to stop working and for nothing to
 * notice until the shop is public, which is the one moment they matter. Setting
 * the flag before the app is required is what exercises the real thing.
 */
process.env.RATE_LIMIT_FORCE = "true";
process.env.JWT_SECRET = "test-secret";

const request = require("supertest");
const app = require("../app");
const { connectTestDB, clearTestDB, closeTestDB } = require("../test/setupTestDb");

beforeAll(async () => {
  await connectTestDB();
});
afterEach(async () => {
  await clearTestDB();
});
afterAll(async () => {
  await closeTestDB();
  delete process.env.RATE_LIMIT_FORCE;
});

/** Fires n requests in order and returns the status codes. */
async function hit(n, send) {
  const codes = [];
  for (let i = 0; i < n; i += 1) codes.push((await send()).status);
  return codes;
}

describe("guessing the admin password", () => {
  test("is refused after ten attempts", async () => {
    const attempt = () =>
      request(app)
        .post("/api/auth/login")
        .send({ email: "nobody@example.com", password: "wrong" });

    const codes = await hit(12, attempt);

    // There is one administrator and one password, and nothing else between a
    // guessed password and the whole shop.
    expect(codes.filter((c) => c === 401)).toHaveLength(10);
    expect(codes.slice(10)).toEqual([429, 429]);
  });

  test("the refusal says how long to wait rather than just failing", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "wrong" });

    expect(res.status).toBe(429);
    expect(res.body.message).toMatch(/fifteen minutes/i);
  });
});

describe("Paystack's webhook", () => {
  test("is never throttled", async () => {
    // Paystack retries anything that is not a 2xx, so a 429 would turn a burst
    // into a payment that never gets recorded. It authenticates by signature,
    // so it is not an open endpoint.
    const codes = await hit(30, () =>
      request(app).post("/api/payments/webhook").send({ event: "charge.success" })
    );

    expect(codes).not.toContain(429);
    // Unsigned, so every one is refused — but refused for the right reason.
    expect(new Set(codes)).toEqual(new Set([401]));
  });
});

describe("browsing", () => {
  test("is not throttled at anything a shopper would do", async () => {
    // A shopper opening the shop pulls a catalogue page, facets and categories
    // at once. Throttling a real customer to deter a hypothetical one is the
    // wrong trade.
    const codes = await hit(40, () => request(app).get("/api/products"));

    expect(codes).not.toContain(429);
  });
});
