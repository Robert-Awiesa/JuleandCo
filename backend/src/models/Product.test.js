const { deriveVariantId, computeTotalStock } = require("./productStock");
const Product = require("./Product");
const { connectTestDB, clearTestDB, closeTestDB } = require("../test/setupTestDb");

describe("productStock helpers", () => {
  test("deriveVariantId combines color and size when size present", () => {
    expect(deriveVariantId("black", "m")).toBe("black--m");
  });

  test("deriveVariantId returns just the color id when there is no size", () => {
    expect(deriveVariantId("black", undefined)).toBe("black");
  });

  test("computeTotalStock sums stock across all variants", () => {
    expect(computeTotalStock([{ stock: 3 }, { stock: 5 }, { stock: 0 }])).toBe(8);
  });

  test("computeTotalStock returns 0 for an empty variant list", () => {
    expect(computeTotalStock([])).toBe(0);
  });
});

describe("Product model stock recomputation", () => {
  beforeAll(async () => {
    await connectTestDB();
  });
  afterEach(async () => {
    await clearTestDB();
  });
  afterAll(async () => {
    await closeTestDB();
  });

  test("recomputes total stock and variant ids on save", async () => {
    const product = await Product.create({
      slug: "test-frame",
      name: "Test Frame",
      category: "eyewear",
      subCategory: "sunglasses",
      price: 100,
      description: "A test product",
      images: ["https://example.com/a.jpg"],
      variants: [
        { colorId: "black", colorLabel: "Black", colorHex: "#000000", stock: 4 },
        { colorId: "tortoise", colorLabel: "Tortoise", colorHex: "#6B4226", stock: 2 },
      ],
    });

    expect(product.stock).toBe(6);
    expect(product.variants[0].id).toBe("black");
    expect(product.variants[1].id).toBe("tortoise");
  });

  test("derives a combined id for color+size variants", async () => {
    const product = await Product.create({
      slug: "test-shirt",
      name: "Test Shirt",
      category: "apparel",
      subCategory: "shirting",
      price: 100,
      description: "A test product",
      images: ["https://example.com/a.jpg"],
      variants: [
        { colorId: "black", colorLabel: "Black", sizeId: "m", sizeLabel: "M", stock: 3 },
      ],
    });

    expect(product.variants[0].id).toBe("black--m");
  });

  test("ignores a client-supplied stock value and recomputes it from variants", async () => {
    const product = await Product.create({
      slug: "test-frame-2",
      name: "Test Frame 2",
      category: "eyewear",
      subCategory: "sunglasses",
      price: 100,
      description: "A test product",
      images: ["https://example.com/a.jpg"],
      stock: 999,
      variants: [{ colorId: "black", colorLabel: "Black", stock: 3 }],
    });

    expect(product.stock).toBe(3);
  });

  test("recomputes stock again when an existing product is re-saved after a variant change", async () => {
    const product = await Product.create({
      slug: "test-frame-3",
      name: "Test Frame 3",
      category: "eyewear",
      subCategory: "sunglasses",
      price: 100,
      description: "A test product",
      images: ["https://example.com/a.jpg"],
      variants: [{ colorId: "black", colorLabel: "Black", stock: 3 }],
    });

    product.variants[0].stock = 10;
    await product.save();

    expect(product.stock).toBe(10);
  });
});
