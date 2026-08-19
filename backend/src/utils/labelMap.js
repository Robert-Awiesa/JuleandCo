const Attribute = require("../models/Attribute");

// One small query per public request, turned into a "group:value" -> label map.
// The Attribute collection is tiny (tens of rows), so this is cheaper than
// denormalising labels onto every product and re-writing them on rename.
async function buildLabelMap() {
  const attributes = await Attribute.find({}, "group value label").lean();
  return new Map(attributes.map((a) => [`${a.group}:${a.value}`, a.label]));
}

module.exports = { buildLabelMap };
