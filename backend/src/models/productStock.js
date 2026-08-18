function deriveVariantId(colorId, sizeId) {
  return sizeId ? `${colorId}--${sizeId}` : colorId;
}

function computeTotalStock(variants) {
  return variants.reduce((sum, v) => sum + (v.stock || 0), 0);
}

module.exports = { deriveVariantId, computeTotalStock };
