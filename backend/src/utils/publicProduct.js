// Translates a Mongo Product into the shape the storefront's `Product` type
// expects (frontend/lib/types.ts).
//
// Two things the database does not store directly:
//   - `colors[]` / `sizes[]` with an `inStock` flag. The storefront renders
//     swatches and size buttons from these; Mongo only has flat `variants[]`,
//     so both axes are collapsed out of it here.
//   - `id`. The storefront keys cart lines and wishlist entries off `product.id`,
//     not `_id`.
//
// Admin-only commerce fields (costPrice, barcode, weightGrams, seo) are
// deliberately dropped — this output is public.

function collapseColors(variants) {
  const byColor = new Map();
  variants.forEach((v) => {
    const existing = byColor.get(v.colorId);
    const stock = Number(v.stock) || 0;
    if (existing) {
      existing.inStock = existing.inStock || stock > 0;
    } else {
      byColor.set(v.colorId, {
        id: v.colorId,
        label: v.colorLabel,
        hex: v.colorHex,
        image: v.colorImage,
        inStock: stock > 0,
      });
    }
  });
  return Array.from(byColor.values());
}

function collapseSizes(variants) {
  const bySize = new Map();
  variants.forEach((v) => {
    if (!v.sizeId) return;
    const existing = bySize.get(v.sizeId);
    const stock = Number(v.stock) || 0;
    if (existing) {
      existing.inStock = existing.inStock || stock > 0;
    } else {
      bySize.set(v.sizeId, { id: v.sizeId, label: v.sizeLabel || v.sizeId, inStock: stock > 0 });
    }
  });
  return Array.from(bySize.values());
}


// Products store an Attribute's stable `value` slug, never its label, so a label
// can be renamed without a data migration. The storefront should not have to
// know the vocabulary to display a product, so the API resolves labels here and
// ships a ready-to-render spec list.
//
// `labels` is a Map keyed "group:value" -> label. Missing entries fall back to
// the raw value, so a product referencing a deleted option still renders.
const SPEC_ROWS = [
  { key: "frameShape", group: "frameShape", label: "Frame Shape" },
  { key: "frameMaterial", group: "frameMaterial", label: "Frame Material" },
  { key: "lensColor", group: "lensType", label: "Lens Colour" },
  { key: "fabric", group: "fabric", label: "Fabric" },
  { key: "composition", group: null, label: "Composition" },
  { key: "fit", group: "fit", label: "Fit" },
  { key: "gender", group: "gender", label: "Designed For" },
  { key: "careInstructions", group: null, label: "Care" },
];

function resolve(labels, group, value) {
  if (!value) return value;
  if (!group || !labels) return value;
  return labels.get(`${group}:${value}`) || value;
}

function buildSpecs(p, labels) {
  const specs = SPEC_ROWS.filter((row) => p[row.key]).map((row) => ({
    key: row.key,
    label: row.label,
    value: resolve(labels, row.group, p[row.key]),
  }));

  const m = p.measurements || {};
  if (m.lensWidthMm || m.bridgeWidthMm || m.templeLengthMm) {
    // The industry writes this as lens-bridge-temple, e.g. 52-18-145.
    specs.push({
      key: "measurements",
      label: "Measurements",
      value: [m.lensWidthMm, m.bridgeWidthMm, m.templeLengthMm].filter(Boolean).join("-") + " mm",
    });
  }

  return specs;
}

function toPublicProduct(doc, labels) {
  if (!doc) return null;
  const p = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const variants = p.variants || [];

  return {
    id: String(p._id),
    slug: p.slug,
    name: p.name,
    category: p.category,
    subCategory: p.subCategory,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    description: p.description,
    images: p.images || [],

    frameShape: p.frameShape,
    frameMaterial: p.frameMaterial,
    lensColor: p.lensColor,
    lensOptions: (p.lensOptions || []).map((value) => ({
      value,
      label: resolve(labels, "lensType", value),
    })),
    measurements: p.measurements,

    clothingSize: p.clothingSize || [],
    fabric: p.fabric,
    composition: p.composition,
    fit: p.fit,

    gender: p.gender,
    careInstructions: p.careInstructions,

    colors: collapseColors(variants),
    sizes: collapseSizes(variants),
    stock: Number(p.stock) || 0,

    isNewArrival: Boolean(p.isNewArrival),
    isBestSeller: Boolean(p.isBestSeller),
    rating: p.rating,
    reviewCount: p.reviewCount,
    // populate() turns these into full docs; keep ids either way.
    pairsWith: (p.pairsWith || []).map((ref) => (ref && ref._id ? String(ref._id) : String(ref))),
    tags: p.tags || [],

    // Pre-resolved, ordered, display-ready — the storefront just renders these.
    specs: buildSpecs(p, labels),
  };
}

module.exports = { toPublicProduct, collapseColors, collapseSizes, buildSpecs };
