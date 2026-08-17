const { buildVariants } = require("./toVariants");

describe("buildVariants", () => {
  test("distributes stock evenly across in-stock colors when there are no sizes", () => {
    const variants = buildVariants({
      stock: 6,
      colors: [
        { id: "tortoise", label: "Tortoise", hex: "#6B4226", inStock: true },
        { id: "black", label: "Black", hex: "#121212", inStock: true },
        { id: "champagne", label: "Champagne", hex: "#D4AF37", inStock: false },
      ],
    });

    expect(variants).toHaveLength(3);
    expect(variants.find((v) => v.colorId === "tortoise").stock).toBe(3);
    expect(variants.find((v) => v.colorId === "black").stock).toBe(3);
    expect(variants.find((v) => v.colorId === "champagne").stock).toBe(0);
  });

  test("distributes stock across color x size combinations", () => {
    const variants = buildVariants({
      stock: 8,
      colors: [{ id: "obsidian", label: "Obsidian", hex: "#121212", inStock: true }],
      sizes: [
        { id: "s", label: "S", inStock: true },
        { id: "m", label: "M", inStock: true },
        { id: "l", label: "L", inStock: false },
      ],
    });

    expect(variants).toHaveLength(3);
    expect(variants.find((v) => v.sizeId === "s").stock).toBe(4);
    expect(variants.find((v) => v.sizeId === "m").stock).toBe(4);
    expect(variants.find((v) => v.sizeId === "l").stock).toBe(0);
  });

  test("falls back to a single default variant when a product has no colors defined", () => {
    const variants = buildVariants({ stock: 2, colors: [] });
    expect(variants).toEqual([{ colorId: "default", colorLabel: "Default", stock: 2 }]);
  });

  test("zeroes stock for every cell when no colors are in stock", () => {
    const variants = buildVariants({
      stock: 5,
      colors: [{ id: "black", label: "Black", hex: "#121212", inStock: false }],
    });
    expect(variants[0].stock).toBe(0);
  });
});
