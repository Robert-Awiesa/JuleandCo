/**
 * Variant identity and stock rollup.
 *
 * Previously this took (colorId, sizeId) — exactly two axes, colour mandatory.
 * That made a one-size bag awkward and a ring with sizes impossible, since the
 * second axis was only ever populated for apparel. It now takes an ordered list
 * of option values, so a category can define however many axes it needs.
 *
 * The join format is unchanged (`a--b`), so ids generated under the old
 * two-axis model still match: colour-only stays "black", colour+size stays
 * "black--m". Nothing has to be re-keyed during migration.
 */
function deriveVariantId(optionValues = []) {
  const parts = (optionValues || [])
    .map((option) => (option && option.value != null ? String(option.value) : ""))
    .filter(Boolean);

  // A product with no options at all is still one sellable thing.
  return parts.length > 0 ? parts.join("--") : "default";
}

function computeTotalStock(variants) {
  return variants.reduce((sum, v) => sum + (v.stock || 0), 0);
}

module.exports = { deriveVariantId, computeTotalStock };
