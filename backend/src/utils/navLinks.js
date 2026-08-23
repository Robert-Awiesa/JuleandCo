const Category = require("../models/Category");
const Subcategory = require("../models/Subcategory");
const Attribute = require("../models/Attribute");
const AttributeGroup = require("../models/AttributeGroup");

/**
 * Checks that every mega-menu link points at something that actually exists.
 *
 * The menu is hand-authored content, and its links are filter URLs — a slug
 * typed slightly wrong, or an attribute that does not apply to the category the
 * link is scoped to, produces a menu entry that can never return anything. The
 * customer clicks and gets an empty shop, and nothing in the admin says why.
 *
 * The distinction that matters:
 *
 *   - **Points at nothing that exists** — a mis-typed sub-category, an unknown
 *     attribute value, a filter that does not apply to that category. Always
 *     wrong, so the save is refused.
 *   - **Points at something real that happens to be empty** — a category with
 *     no stock in it yet. Perfectly reasonable: the products come later, and the
 *     count beside the link already shows a zero.
 *
 * Only the first is an error. Refusing the second would stop a shop preparing a
 * line before it launches.
 */

/** Params that steer the shop rather than filter it. */
const NON_FILTER = new Set(["category", "sort", "page", "minPrice", "maxPrice", "search"]);

async function validateMenuLinks(sections) {
  if (!Array.isArray(sections)) return [];

  const [categories, subcategories, groups, attributes] = await Promise.all([
    Category.find({}, "slug name isActive").lean(),
    Subcategory.find({}, "slug categoryType").lean(),
    AttributeGroup.find({}, "key label categories").lean(),
    Attribute.find({}, "group value").lean(),
  ]);

  const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));
  const subSlugs = new Set(subcategories.map((s) => `${s.categoryType}/${s.slug}`));
  const groupByKey = new Map(groups.map((g) => [g.key, g]));
  const attrValues = new Set(attributes.map((a) => `${a.group}/${a.value}`));

  const problems = [];

  sections.forEach((section) => {
    const where = section.label || section.key || "A menu section";

    if (section.key && !categoryBySlug.has(section.key)) {
      problems.push(`${where}: "${section.key}" is not a category`);
    }

    (section.columns || []).forEach((column) => {
      (column.links || []).forEach((link) => {
        const [, queryString] = String(link.href || "").split("?");
        if (!queryString) return;

        const params = new URLSearchParams(queryString);
        const category = params.get("category");
        const label = `${where} › ${column.title || "?"} › ${link.label || link.href}`;

        if (category && !categoryBySlug.has(category)) {
          problems.push(`${label} filters by "${category}", which is not a category`);
          return;
        }

        for (const [key, value] of params) {
          if (NON_FILTER.has(key)) continue;

          if (key === "subCategory") {
            if (category && !subSlugs.has(`${category}/${value}`)) {
              problems.push(
                `${label}: "${value}" is not a sub-category of ${categoryBySlug.get(category).name}`
              );
            }
            continue;
          }

          const group = groupByKey.get(key);
          if (!group) {
            problems.push(`${label}: "${key}" is not an attribute`);
            continue;
          }

          // An empty `categories` list means the group applies everywhere.
          if (category && group.categories?.length && !group.categories.includes(category)) {
            problems.push(
              `${label}: "${group.label}" does not apply to ${categoryBySlug.get(category).name}`
            );
          }

          if (!attrValues.has(`${key}/${value}`)) {
            problems.push(`${label}: "${value}" is not one of the ${group.label} options`);
          }
        }
      });
    });
  });

  return problems;
}

module.exports = { validateMenuLinks };
