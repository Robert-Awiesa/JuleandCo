const Attribute = require("../models/Attribute");
const AttributeGroup = require("../models/AttributeGroup");
const Category = require("../models/Category");

/**
 * Loads everything the public serializer needs to turn stored attribute codes
 * into display text: the label lookup, the group definitions, and the category
 * records that bind groups to products.
 *
 * Three small queries per request. All three collections are tiny (tens of
 * rows), which is cheaper than denormalising labels onto every product and
 * having to rewrite them whenever one is renamed — the reason products store a
 * stable `value` slug in the first place.
 */
async function buildCatalogContext() {
  const [attributes, groups, categories] = await Promise.all([
    Attribute.find({}, "group value label").lean(),
    AttributeGroup.find({}).lean(),
    Category.find({}).lean(),
  ]);

  const labels = new Map(attributes.map((a) => [`${a.group}:${a.value}`, a.label]));
  const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));

  // A group with no categories listed applies everywhere.
  const groupsFor = (categorySlug) =>
    groups.filter((g) => !g.categories?.length || g.categories.includes(categorySlug));

  return {
    labels,
    groups,
    categories,
    categoryBySlug,
    groupsFor,

    /** Per-product serializer context — the category config and its groups. */
    forProduct(product) {
      const slug = product?.category;
      const applicable = groupsFor(slug);
      return {
        labels,
        category: categoryBySlug.get(slug) || null,
        specGroups: applicable.filter((g) => g.role === "spec"),
        // Picked on the product page but not stock-bearing, e.g. lens type.
        selectionGroups: applicable.filter((g) => g.role === "selection"),
      };
    },
  };
}

module.exports = { buildCatalogContext };
