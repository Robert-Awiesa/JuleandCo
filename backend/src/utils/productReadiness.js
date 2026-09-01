/**
 * What a product must have before it can go on the storefront.
 *
 * Publishing is where things break silently: a product with no images renders
 * an empty card, and one with options but no variants shows a picker that can
 * never be added to the cart. Both were reachable through the form.
 *
 * The admin form shows the same checklist as you type
 * (frontend/app/admin/_components/products/readiness.ts). That copy is advisory
 * — this one is the gate. Keep the rule ids identical so the two can be
 * compared when either changes.
 */

const PUBLISH_RULES = [
  {
    id: "images",
    label: "At least one image",
    reason: "A published product with no image renders an empty card.",
    test: (p) => (p.images || []).length > 0,
  },
  {
    id: "subCategory",
    label: "A sub-category",
    reason: "Navigation and filters place the product by its sub-category.",
    test: (p) => Boolean(p.subCategory),
  },
  {
    id: "price",
    label: "A price above zero",
    reason: "A zero price would be sold as free.",
    test: (p) => Number(p.price) > 0,
  },
  {
    id: "variants",
    label: "A variant for every option",
    reason:
      "This product has options but no variants, so a customer could choose one and never add it to the cart.",
    test: (p) => (p.options || []).length === 0 || (p.variants || []).length > 0,
  },
  {
    id: "optionValues",
    label: "A value for every option",
    /**
     * An axis with nothing in it is worse than no axis at all.
     *
     * The product page renders the heading — "Frame Colour" — with no swatches
     * beneath it, so the customer is asked to choose from nothing. No variant
     * can match a choice that cannot be made, so the button reads SOLD OUT
     * while the stock figure beside it says one left. The rule above passes
     * this happily: there *is* an option and there *is* a variant.
     */
    reason:
      "An option with no values asks the customer to choose from an empty list, so nothing can be added to the cart and the product reads as sold out however much stock it has.",
    test: (p) => (p.options || []).every((o) => (o.values || []).length > 0),
  },
  {
    id: "variantsMatchOptions",
    label: "Stock held against the actual options",
    /**
     * The stock grid can fall out of step with the axes.
     *
     * A product that had no colours, then gained two, kept its single unnamed
     * variant — so the stock sat on a row carrying no option values at all,
     * every colour reported out of stock, and the page said SOLD OUT beside
     * "only 1 left". The two rules above both pass that: there are options,
     * there is a variant, and the options have values.
     *
     * The check is deliberately loose — one variant naming each axis, rather
     * than every combination — because a shop may legitimately stock only some
     * combinations. What it will not allow is a grid that names none of them.
     */
    reason:
      "The stock grid does not match this product's options, so no choice a customer makes can find its stock. Open the Inventory tab to rebuild it.",
    test: (p) => {
      const axes = (p.options || []).filter((o) => (o.values || []).length > 0);
      if (axes.length === 0) return true;

      // Having no variants at all is the rule above's to report. Saying it
      // twice makes the checklist read as two separate faults.
      if ((p.variants || []).length === 0) return true;

      return axes.every((axis) =>
        (p.variants || []).some((v) =>
          (v.optionValues || []).some((ov) => ov.name === axis.name)
        )
      );
    },
  },
];

/** The rules a product fails. Empty means it is safe to publish. */
function publishBlockers(product) {
  return PUBLISH_RULES.filter((rule) => !rule.test(product)).map(({ id, label, reason }) => ({
    id,
    label,
    reason,
  }));
}

/** One sentence naming everything missing, for an API error message. */
function describeBlockers(blockers) {
  const list = blockers.map((b) => b.label.toLowerCase()).join(", ");
  return `This product cannot be published yet — it still needs: ${list}.`;
}

module.exports = { PUBLISH_RULES, publishBlockers, describeBlockers };
