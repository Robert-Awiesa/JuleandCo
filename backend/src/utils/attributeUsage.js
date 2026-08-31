const Product = require("../models/Product");

/**
 * Where an attribute value can be used by a product.
 *
 * Two places, and only one of them was ever checked:
 *
 *   `attributes.<groupKey>`        — spec and selection values. A string, or an
 *                                    array for a multiselect group.
 *   `options[].values[].value`     — variant axes. A stock-bearing axis such as
 *                                    metal or ring size lives here and is
 *                                    **absent from `attributes` entirely**.
 *
 * The delete guard only looked at the first, so deleting "Yellow Gold" reported
 * nought products using it while two necklaces were actively sold in it — the
 * option would vanish and those products would reference a value that no longer
 * existed. That is the same class of silent orphaning the group-key refactor was
 * meant to end; it was fixed for specs and never extended to variant axes.
 */

/** Products using one value of one group, counted across both locations. */
function countProductsUsing(group, value) {
  return Product.countDocuments({
    $or: [
      { [`attributes.${group}`]: value },
      { options: { $elemMatch: { groupKey: group, "values.value": value } } },
    ],
  });
}

/** Products using a group at all, whatever the value. */
function countProductsUsingGroup(group) {
  return Product.countDocuments({
    $or: [
      { [`attributes.${group}`]: { $exists: true } },
      { options: { $elemMatch: { groupKey: group } } },
    ],
  });
}

/**
 * How many products use every value in use, in one pass.
 *
 * Two aggregations rather than 109 count queries — the admin needs this for
 * every option on the page at once, and one request per option would be slow
 * anywhere and expensive on a serverless deployment.
 *
 * Returns a plain object keyed `"<group>:<value>"`, which the admin can look up
 * directly without another loop.
 */
async function usageByValue() {
  const [specs, axes] = await Promise.all([
    Product.aggregate([
      { $project: { pairs: { $objectToArray: { $ifNull: ["$attributes", {}] } } } },
      { $unwind: "$pairs" },
      // A multiselect group stores an array. $unwind treats a non-array as a
      // single-element array, so scalars pass through untouched.
      { $unwind: "$pairs.v" },
      { $group: { _id: { group: "$pairs.k", value: "$pairs.v" }, count: { $sum: 1 } } },
    ]),
    Product.aggregate([
      { $unwind: "$options" },
      { $match: { "options.groupKey": { $nin: [null, ""] } } },
      { $unwind: "$options.values" },
      {
        $group: {
          _id: { group: "$options.groupKey", value: "$options.values.value" },
          // A product is counted once per value even if the axis repeats it.
          products: { $addToSet: "$_id" },
        },
      },
      { $project: { count: { $size: "$products" } } },
    ]),
  ]);

  const usage = {};
  for (const row of [...specs, ...axes]) {
    if (row._id.value === null || row._id.value === undefined) continue;
    const key = `${row._id.group}:${row._id.value}`;
    usage[key] = (usage[key] || 0) + row.count;
  }
  return usage;
}

module.exports = { countProductsUsing, countProductsUsingGroup, usageByValue };
