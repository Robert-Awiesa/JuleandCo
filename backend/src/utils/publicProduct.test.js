const {
  toPublicProduct,
  buildSpecs,
  buildSelections,
  buildOptions,
  renderTemplate,
  attributesToObject,
} = require("./publicProduct");

const specGroups = [
  { key: "frameShape", label: "Frame Shape", role: "spec", sortOrder: 1 },
  { key: "gemstone", label: "Gemstone", role: "spec", sortOrder: 2 },
  { key: "weight", label: "Weight", role: "spec", unit: "g", sortOrder: 3 },
];

const eyewearCategory = {
  slug: "eyewear",
  combinedSpecs: [
    { label: "Measurements", template: "{lensWidthMm}-{bridgeWidthMm}-{templeLengthMm} mm" },
  ],
};

const labels = new Map([
  ["frameShape:aviator", "Aviator"],
  ["lensType:gold-mirror", "Gold Mirror"],
  ["metal:rose-gold", "Rose Gold"],
]);

describe("attributesToObject", () => {
  test("unwraps a Mongoose Map", () => {
    expect(attributesToObject(new Map([["frameShape", "aviator"]]))).toEqual({ frameShape: "aviator" });
  });

  test("passes a plain object through", () => {
    expect(attributesToObject({ fabric: "wool" })).toEqual({ fabric: "wool" });
  });

  test("treats a missing attributes field as empty", () => {
    expect(attributesToObject(undefined)).toEqual({});
  });
});

describe("buildSpecs", () => {
  test("resolves codes to labels using the vocabulary", () => {
    const specs = buildSpecs({ frameShape: "aviator" }, { specGroups, labels });
    expect(specs).toEqual([{ key: "frameShape", label: "Frame Shape", value: "Aviator" }]);
  });

  test("falls back to the raw value when the vocabulary has no entry", () => {
    const specs = buildSpecs({ frameShape: "mystery" }, { specGroups, labels });
    expect(specs[0].value).toBe("mystery");
  });

  test("omits groups the product does not set", () => {
    expect(buildSpecs({}, { specGroups, labels })).toEqual([]);
  });

  test("omits a group whose value is an empty array", () => {
    expect(buildSpecs({ gemstone: [] }, { specGroups, labels })).toEqual([]);
  });

  test("joins multiselect values into one row", () => {
    const specs = buildSpecs({ gemstone: ["ruby", "opal"] }, { specGroups, labels });
    expect(specs[0].value).toBe("ruby, opal");
  });

  test("appends the group's unit", () => {
    const specs = buildSpecs({ weight: 12 }, { specGroups, labels });
    expect(specs[0].value).toBe("12 g");
  });

  test("orders rows by the group's sortOrder, not insertion order", () => {
    const specs = buildSpecs({ gemstone: "opal", frameShape: "aviator" }, { specGroups, labels });
    expect(specs.map((s) => s.key)).toEqual(["frameShape", "gemstone"]);
  });

  test("renders a category's combined spec", () => {
    const specs = buildSpecs(
      { lensWidthMm: 52, bridgeWidthMm: 18, templeLengthMm: 145 },
      { specGroups: [], category: eyewearCategory, labels }
    );
    expect(specs).toEqual([{ key: "Measurements", label: "Measurements", value: "52-18-145 mm" }]);
  });

  test("skips a combined spec when none of its inputs are present", () => {
    expect(buildSpecs({}, { specGroups: [], category: eyewearCategory, labels })).toEqual([]);
  });
});

describe("renderTemplate", () => {
  test("drops a missing value and the separator it orphans", () => {
    expect(renderTemplate("{a}-{b}-{c} mm", { a: 52, c: 145 })).toBe("52-145 mm");
  });

  test("returns null when nothing is available", () => {
    expect(renderTemplate("{a}-{b}", {})).toBeNull();
  });

  test("supports a bag-style dimension template", () => {
    expect(renderTemplate("{h} × {w} × {d} cm", { h: 30, w: 20, d: 12 })).toBe("30 × 20 × 12 cm");
  });
});

describe("buildOptions", () => {
  const product = {
    options: [
      {
        name: "Metal",
        groupKey: "metal",
        values: [
          { value: "rose-gold", label: "Rose Gold", hex: "#B76E79" },
          { value: "silver", label: "Silver" },
        ],
      },
    ],
    variants: [
      { optionValues: [{ name: "Metal", value: "rose-gold" }], stock: 2 },
      { optionValues: [{ name: "Metal", value: "silver" }], stock: 0 },
    ],
  };

  test("marks a value in stock when any variant carrying it has stock", () => {
    const [option] = buildOptions(product, labels);
    expect(option.values.find((v) => v.value === "rose-gold").inStock).toBe(true);
  });

  test("marks a value out of stock when every variant carrying it is zero", () => {
    const [option] = buildOptions(product, labels);
    expect(option.values.find((v) => v.value === "silver").inStock).toBe(false);
  });

  test("carries the swatch hex through for the storefront", () => {
    const [option] = buildOptions(product, labels);
    expect(option.values[0].hex).toBe("#B76E79");
  });

  test("a product with no options yields none", () => {
    expect(buildOptions({ options: [], variants: [] }, labels)).toEqual([]);
  });
});

describe("buildSelections", () => {
  const selectionGroups = [{ key: "lensType", label: "Lens", role: "selection", sortOrder: 1 }];

  test("labels each selectable value", () => {
    const out = buildSelections({ lensType: ["gold-mirror", "smoke"] }, { selectionGroups, labels });
    expect(out).toEqual([
      {
        key: "lensType",
        label: "Lens",
        values: [
          { value: "gold-mirror", label: "Gold Mirror" },
          { value: "smoke", label: "smoke" },
        ],
      },
    ]);
  });

  test("accepts a single value as well as a list", () => {
    const out = buildSelections({ lensType: "gold-mirror" }, { selectionGroups, labels });
    expect(out[0].values).toHaveLength(1);
  });

  test("omits a selection the product does not offer", () => {
    expect(buildSelections({}, { selectionGroups, labels })).toEqual([]);
  });
});

describe("toPublicProduct", () => {
  const doc = {
    _id: "6a83bec3461143bbd41815f4",
    slug: "x",
    category: "eyewear",
    attributes: { frameShape: "aviator" },
    options: [],
    variants: [],
    costPrice: 40,
    barcode: "123",
    weightGrams: 30,
    seo: { title: "t" },
  };

  test("maps _id to the id the storefront keys off", () => {
    expect(toPublicProduct(doc, { labels }).id).toBe("6a83bec3461143bbd41815f4");
  });

  test("never leaks admin-only commerce fields", () => {
    const out = toPublicProduct(doc, { labels });
    expect(out.costPrice).toBeUndefined();
    expect(out.barcode).toBeUndefined();
    expect(out.weightGrams).toBeUndefined();
    expect(out.seo).toBeUndefined();
  });

  test("exposes raw attribute values for filtering alongside display specs", () => {
    const out = toPublicProduct(doc, { labels, specGroups });
    expect(out.attributes.frameShape).toBe("aviator");
    expect(out.specs[0].value).toBe("Aviator");
  });

  test("normalises pairsWith to string ids whether populated or not", () => {
    const out = toPublicProduct(
      {
        ...doc,
        pairsWith: ["6a83bec3461143bbd41815f4", { _id: "6a83bec3461143bbd41815f5", name: "Other" }],
      },
      { labels }
    );
    expect(out.pairsWith).toEqual(["6a83bec3461143bbd41815f4", "6a83bec3461143bbd41815f5"]);
  });

  test("returns null for a missing document", () => {
    expect(toPublicProduct(null)).toBeNull();
  });
});
