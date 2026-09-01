const { publishBlockers } = require("./productReadiness");

/**
 * An axis with nothing in it is worse than no axis at all: the product page
 * renders "Frame Colour" with no swatches beneath it, so the customer is asked
 * to choose from an empty list. No variant can match a choice that cannot be
 * made, and the button reads SOLD OUT while the stock figure beside it says one
 * left. Found on a live product that published cleanly.
 */
describe("an option with no values", () => {
  const base = {
    images: ["https://example.com/a.jpg"],
    subCategory: "sunglasses",
    price: 100,
  };

  test("blocks publishing", () => {
    const blockers = publishBlockers({
      ...base,
      options: [{ name: "Frame Colour", values: [] }],
      variants: [{ id: "default", optionValues: [], stock: 1 }],
    });

    // The older "a variant for every option" rule passes this happily — there
    // is an option and there is a variant — which is exactly how it shipped.
    expect(blockers.map((b) => b.id)).toContain("optionValues");
  });

  test("an option with values does not block", () => {
    const blockers = publishBlockers({
      ...base,
      options: [{ name: "Frame Colour", values: [{ value: "black", label: "Black" }] }],
      variants: [{ id: "black", optionValues: [{ name: "Frame Colour", value: "black" }], stock: 1 }],
    });

    expect(blockers.map((b) => b.id)).not.toContain("optionValues");
  });

  test("a product with no options at all is unaffected", () => {
    const blockers = publishBlockers({ ...base, options: [], variants: [] });
    expect(blockers).toEqual([]);
  });

  test("one empty axis among several still blocks", () => {
    const blockers = publishBlockers({
      ...base,
      options: [
        { name: "Metal", values: [{ value: "gold", label: "Gold" }] },
        { name: "Length", values: [] },
      ],
      variants: [{ id: "gold", optionValues: [{ name: "Metal", value: "gold" }], stock: 1 }],
    });

    expect(blockers.map((b) => b.id)).toContain("optionValues");
  });
});

/**
 * The grid can fall out of step with the axes: a product that had no colours,
 * then gained two, kept its single unnamed variant. Stock sat on a row carrying
 * no option values, every colour reported out of stock, and the page said SOLD
 * OUT beside "only 1 left".
 */
describe("stock held against the actual options", () => {
  const base = { images: ["https://example.com/a.jpg"], subCategory: "sunglasses", price: 100 };
  const colour = { name: "Frame Colour", values: [{ value: "black", label: "Black" }] };

  test("a variant naming none of the axes blocks", () => {
    const ids = publishBlockers({
      ...base,
      options: [colour],
      variants: [{ id: "default", optionValues: [], stock: 1 }],
    }).map((b) => b.id);

    // The three rules before it all pass: there are options, there is a
    // variant, and the option has values.
    expect(ids).toEqual(["variantsMatchOptions"]);
  });

  test("a variant naming the axis does not block", () => {
    const ids = publishBlockers({
      ...base,
      options: [colour],
      variants: [{ id: "black", optionValues: [{ name: "Frame Colour", value: "black" }], stock: 1 }],
    }).map((b) => b.id);

    expect(ids).toEqual([]);
  });

  test("stocking only some combinations is allowed", () => {
    // A shop may legitimately carry black in one length and not another; the
    // rule only refuses a grid that names no combination at all.
    const ids = publishBlockers({
      ...base,
      options: [
        colour,
        { name: "Length", values: [{ value: "16in", label: "16 in" }, { value: "18in", label: "18 in" }] },
      ],
      variants: [
        {
          id: "black-16in",
          optionValues: [
            { name: "Frame Colour", value: "black" },
            { name: "Length", value: "16in" },
          ],
          stock: 1,
        },
      ],
    }).map((b) => b.id);

    expect(ids).toEqual([]);
  });

  test("a single-item product with no axes is unaffected", () => {
    expect(publishBlockers({ ...base, options: [], variants: [] })).toEqual([]);
  });
});
