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
