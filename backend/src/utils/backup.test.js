const { gzipSync } = require("zlib");
const { EJSON } = require("bson");
const mongoose = require("mongoose");
const { dumpDatabase, writeArchive, verifyArchive } = require("./backup");
const Product = require("../models/Product");
const { connectTestDB, clearTestDB, closeTestDB } = require("../test/setupTestDb");
const { seedCatalogConfig, productFixture } = require("../test/catalogFixtures");

beforeAll(async () => {
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

/** An archive as writeArchive produces one, without touching Cloudinary. */
function archiveOf(object) {
  return gzipSync(Buffer.from(EJSON.stringify(object, { relaxed: false }), "utf8"));
}

describe("taking a dump", () => {
  test("captures every collection with a count for each", async () => {
    await Product.create(productFixture());

    const { payload, counts } = await dumpDatabase();

    expect(counts.products).toBe(1);
    expect(counts.categories).toBeGreaterThan(0);
    expect(payload).toContain("The Aviator");
  });

  test("object ids survive the round trip", async () => {
    const product = await Product.create(productFixture());
    const partner = await Product.create(
      productFixture({ slug: "partner", pairsWith: [product._id] })
    );

    const { payload } = await dumpDatabase();
    const parsed = EJSON.parse(payload);
    const restored = parsed.data.products.find((p) => p.slug === "partner");

    /**
     * The reason extended JSON is used rather than JSON.stringify: a plain
     * stringify turns an ObjectId into a string, and every cross-reference —
     * cross-sell links, order lines, reviews — would silently stop matching on
     * restore. The break would only surface long after the restore looked fine.
     */
    expect(restored.pairsWith[0]).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(String(restored.pairsWith[0])).toBe(String(product._id));
    expect(partner).toBeTruthy();
  });

  test("compresses to a fraction of the raw size", async () => {
    await Product.create(productFixture());
    const { payload } = await dumpDatabase();
    const { size } = await writeArchive(payload);

    expect(size).toBeLessThan(Buffer.byteLength(payload));
  });
});

describe("verifying an archive", () => {
  test("accepts one that is intact", async () => {
    await Product.create(productFixture());
    const { payload } = await dumpDatabase();

    const parsed = verifyArchive(gzipSync(Buffer.from(payload, "utf8")));
    expect(parsed.data.products).toHaveLength(1);
  });

  test("rejects one whose contents do not match its own header", () => {
    // The failure that matters: a dump that truncated partway would still
    // gunzip and parse, and would look like a backup until the day it was
    // needed.
    const tampered = archiveOf({
      takenAt: new Date().toISOString(),
      database: "test",
      counts: { products: 5 },
      data: { products: [{ name: "only one" }] },
    });

    expect(() => verifyArchive(tampered)).toThrow(/header says 5.*holds 1/i);
  });

  test("rejects one with no data at all", () => {
    const empty = archiveOf({ takenAt: new Date().toISOString(), database: "test" });
    expect(() => verifyArchive(empty)).toThrow(/no data/i);
  });

  test("rejects bytes that are not a valid archive", () => {
    expect(() => verifyArchive(Buffer.from("not gzipped at all"))).toThrow();
  });

  test("an empty collection is not treated as corruption", async () => {
    // A shop with no orders yet must still produce a valid backup.
    const { payload } = await dumpDatabase();
    const parsed = verifyArchive(gzipSync(Buffer.from(payload, "utf8")));

    expect(parsed.counts).toBeDefined();
  });
});
