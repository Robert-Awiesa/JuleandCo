const { toPublicProduct, collapseColors, collapseSizes } = require("./publicProduct");

const variants = [
  { id: "black--s", colorId: "black", colorLabel: "Black", colorHex: "#121212", sizeId: "s", sizeLabel: "S", stock: 0 },
  { id: "black--m", colorId: "black", colorLabel: "Black", colorHex: "#121212", sizeId: "m", sizeLabel: "M", stock: 4 },
  { id: "camel--s", colorId: "camel", colorLabel: "Camel", colorHex: "#B08A5A", sizeId: "s", sizeLabel: "S", stock: 0 },
];

test("collapses variants into one entry per colour", () => {
  const colors = collapseColors(variants);
  expect(colors.map((c) => c.id)).toEqual(["black", "camel"]);
});

test("a colour is in stock when any of its variants has stock", () => {
  const colors = collapseColors(variants);
  expect(colors.find((c) => c.id === "black").inStock).toBe(true);
});

test("a colour is out of stock when every variant is zero", () => {
  const colors = collapseColors(variants);
  expect(colors.find((c) => c.id === "camel").inStock).toBe(false);
});

test("collapses variants into one entry per size", () => {
  const sizes = collapseSizes(variants);
  expect(sizes.map((s) => s.id)).toEqual(["s", "m"]);
});

test("size S is out of stock across both colours, M is in stock", () => {
  const sizes = collapseSizes(variants);
  expect(sizes.find((s) => s.id === "s").inStock).toBe(false);
  expect(sizes.find((s) => s.id === "m").inStock).toBe(true);
});

test("eyewear with no sizes yields an empty sizes array", () => {
  const eyewear = [{ id: "black", colorId: "black", colorLabel: "Black", stock: 2 }];
  expect(collapseSizes(eyewear)).toEqual([]);
});

test("maps _id to the id the storefront keys off", () => {
  const out = toPublicProduct({ _id: "6a83bec3461143bbd41815f4", slug: "x", variants: [] });
  expect(out.id).toBe("6a83bec3461143bbd41815f4");
});

test("never leaks admin-only commerce fields", () => {
  const out = toPublicProduct({
    _id: "1",
    slug: "x",
    variants: [],
    costPrice: 40,
    barcode: "123",
    weightGrams: 30,
    seo: { title: "t" },
  });
  expect(out.costPrice).toBeUndefined();
  expect(out.barcode).toBeUndefined();
  expect(out.weightGrams).toBeUndefined();
  expect(out.seo).toBeUndefined();
});

test("normalises pairsWith to string ids whether populated or not", () => {
  const out = toPublicProduct({
    _id: "1",
    slug: "x",
    variants: [],
    pairsWith: ["6a83bec3461143bbd41815f4", { _id: "6a83bec3461143bbd41815f5", name: "Other" }],
  });
  expect(out.pairsWith).toEqual(["6a83bec3461143bbd41815f4", "6a83bec3461143bbd41815f5"]);
});

test("returns null for a missing document", () => {
  expect(toPublicProduct(null)).toBeNull();
});

test("builds display specs from raw values, resolving labels", () => {
  const labels = new Map([["frameShape:aviator", "Aviator"]]);
  const out = toPublicProduct({ _id: "1", slug: "x", variants: [], frameShape: "aviator" }, labels);
  expect(out.specs).toEqual([{ key: "frameShape", label: "Frame Shape", value: "Aviator" }]);
});

test("falls back to the raw value when the vocabulary has no entry", () => {
  const out = toPublicProduct({ _id: "1", slug: "x", variants: [], frameShape: "mystery" }, new Map());
  expect(out.specs[0].value).toBe("mystery");
});

test("omits spec rows for fields the product does not set", () => {
  const out = toPublicProduct({ _id: "1", slug: "x", variants: [] }, new Map());
  expect(out.specs).toEqual([]);
});

test("formats eyewear measurements as lens-bridge-temple", () => {
  const out = toPublicProduct(
    { _id: "1", slug: "x", variants: [], measurements: { lensWidthMm: 52, bridgeWidthMm: 18, templeLengthMm: 145 } },
    new Map()
  );
  expect(out.specs.find((s) => s.key === "measurements").value).toBe("52-18-145 mm");
});

test("labels lens options for the storefront selector", () => {
  const labels = new Map([["lensType:gold-mirror", "Gold Mirror"]]);
  const out = toPublicProduct({ _id: "1", slug: "x", variants: [], lensOptions: ["gold-mirror", "smoke"] }, labels);
  expect(out.lensOptions).toEqual([
    { value: "gold-mirror", label: "Gold Mirror" },
    { value: "smoke", label: "smoke" },
  ]);
});
