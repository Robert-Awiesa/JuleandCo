function slugifyId(label) {
  return label.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function buildVariants(product) {
  const colors = product.colors || [];
  const sizes = product.sizes || [];
  const totalStock = product.stock || 0;

  if (colors.length === 0) {
    return [{ colorId: "default", colorLabel: "Default", stock: totalStock }];
  }

  const inStockColors = colors.filter((c) => c.inStock);
  const perColorStock =
    inStockColors.length > 0 ? Math.floor(totalStock / inStockColors.length) : 0;

  if (sizes.length === 0) {
    return colors.map((color) => ({
      colorId: color.id || slugifyId(color.label),
      colorLabel: color.label,
      colorHex: color.hex,
      stock: color.inStock ? perColorStock : 0,
    }));
  }

  const inStockSizes = sizes.filter((s) => s.inStock);
  const perCellStock =
    inStockSizes.length > 0 ? Math.floor(perColorStock / inStockSizes.length) : 0;

  const variants = [];
  colors.forEach((color) => {
    sizes.forEach((size) => {
      variants.push({
        colorId: color.id || slugifyId(color.label),
        colorLabel: color.label,
        colorHex: color.hex,
        sizeId: size.id || slugifyId(size.label),
        sizeLabel: size.label,
        stock: color.inStock && size.inStock ? perCellStock : 0,
      });
    });
  });
  return variants;
}

module.exports = { buildVariants };
