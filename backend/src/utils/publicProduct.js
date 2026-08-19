/**
 * Translates a Mongo Product into the shape the storefront renders.
 *
 * Everything category-specific used to be hardcoded here: an ordered SPEC_ROWS
 * table naming eyewear and apparel fields, a special case that formatted
 * eyewear's lens-bridge-temple measurements, and a hand-written list of every
 * field allowed through. Adding a jewellery spec meant editing all three. Specs
 * are now derived from the AttributeGroup definitions bound to the product's
 * category, so a new spec row is a data change.
 *
 * Admin-only commerce fields (costPrice, barcode, weightGrams, seo) are
 * deliberately dropped — this output is public.
 */

/** Product.attributes is a Mongoose Map on documents, a plain object on lean reads. */
function attributesToObject(attributes) {
  if (!attributes) return {};
  if (attributes instanceof Map) return Object.fromEntries(attributes);
  return { ...attributes };
}

function resolve(labels, group, value) {
  if (!value) return value;
  if (!group || !labels) return value;
  return labels.get(`${group}:${value}`) || value;
}

/**
 * Fills a combined-spec template such as "{lensWidthMm}-{bridgeWidthMm} mm".
 *
 * A missing value takes its adjacent separator with it, so a frame with only
 * two of three measurements still reads "52-145 mm" rather than "52--145 mm".
 * Returns null when nothing at all is available, so the row is skipped.
 *
 * Works by splitting the template into placeholder and literal chunks and only
 * emitting a literal once a value has been written and another follows. An
 * earlier version used a sentinel character for this and wrote a raw NUL byte
 * into the source file, which made git treat it as binary.
 */
function renderTemplate(template, attributes) {
  const parts = template.split(/(\{\w+\})/).filter((chunk) => chunk !== "");

  const rendered = parts.map((chunk) => {
    const placeholder = chunk.match(/^\{(\w+)\}$/);
    if (!placeholder) return { literal: chunk };

    const value = attributes[placeholder[1]];
    const missing = value === undefined || value === null || value === "";
    return { value: missing ? null : String(value) };
  });

  if (!rendered.some((part) => part.value != null)) return null;

  let out = "";
  let pendingLiteral = "";

  rendered.forEach((part) => {
    if (part.literal !== undefined) {
      // Held back until we know another value follows; a literal before the
      // first value, or after the last, is dropped or appended accordingly.
      if (out) pendingLiteral = part.literal;
      return;
    }
    if (part.value == null) return;

    out += (out ? pendingLiteral : "") + part.value;
    pendingLiteral = "";
  });

  // Whatever trails the final value is the unit, e.g. " mm".
  out += pendingLiteral;

  return out.replace(/\s+/g, " ").trim() || null;
}

/**
 * Display-ready spec rows, ordered by the group's sortOrder, followed by any
 * combined specs the category defines.
 */
function buildSpecs(attributes, { specGroups = [], category = null, labels = null } = {}) {
  const specs = [];

  [...specGroups]
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .forEach((group) => {
      const raw = attributes[group.key];
      if (raw === undefined || raw === null || raw === "") return;
      if (Array.isArray(raw) && raw.length === 0) return;

      const value = Array.isArray(raw)
        ? raw.map((v) => resolve(labels, group.key, v)).join(", ")
        : resolve(labels, group.key, raw);

      specs.push({
        key: group.key,
        label: group.label,
        value: group.unit ? `${value} ${group.unit}` : String(value),
      });
    });

  (category?.combinedSpecs || []).forEach((spec) => {
    const value = renderTemplate(spec.template, attributes);
    if (value) specs.push({ key: spec.label, label: spec.label, value });
  });

  return specs;
}

/**
 * Options with per-value availability.
 *
 * The storefront needs to know which swatches to disable, but stock lives on
 * variants. A value is in stock when any variant carrying it has stock.
 */
function buildOptions(product, labels) {
  const variants = product.variants || [];

  return (product.options || []).map((option) => ({
    name: option.name,
    groupKey: option.groupKey,
    values: (option.values || []).map((value) => ({
      value: value.value,
      label: value.label || resolve(labels, option.groupKey, value.value),
      hex: value.hex,
      image: value.image,
      inStock: variants.some(
        (variant) =>
          (variant.stock || 0) > 0 &&
          (variant.optionValues || []).some(
            (ov) => ov.name === option.name && ov.value === value.value
          )
      ),
    })),
  }));
}

/**
 * Choices the customer makes that do not affect stock — lens type being the
 * case this was built for. Every lens is available in every frame colour, so
 * offering them as stock-bearing variants would multiply the inventory grid
 * for no gain. They are recorded on the cart line instead.
 */
function buildSelections(attributes, { selectionGroups = [], labels = null } = {}) {
  return selectionGroups
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map((group) => {
      const raw = attributes[group.key];
      const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
      return {
        key: group.key,
        label: group.label,
        values: values.map((value) => ({
          value,
          label: resolve(labels, group.key, value),
        })),
      };
    })
    .filter((selection) => selection.values.length > 0);
}

function toPublicProduct(doc, context = {}) {
  if (!doc) return null;
  const p = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const attributes = attributesToObject(p.attributes);

  return {
    // The storefront keys cart lines and wishlist entries off `id`, not `_id`.
    id: String(p._id),
    slug: p.slug,
    name: p.name,
    category: p.category,
    subCategory: p.subCategory,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    description: p.description,
    images: p.images || [],

    // Raw values, for client-side filtering and links. Use `specs` to display.
    attributes,
    options: buildOptions(p, context.labels),
    variants: (p.variants || []).map((v) => ({
      id: v.id,
      optionValues: v.optionValues || [],
      inStock: (v.stock || 0) > 0,
    })),
    stock: Number(p.stock) || 0,

    isNewArrival: Boolean(p.isNewArrival),
    isBestSeller: Boolean(p.isBestSeller),
    rating: p.rating,
    reviewCount: p.reviewCount,
    // populate() turns these into full docs; keep ids either way.
    pairsWith: (p.pairsWith || []).map((ref) => (ref && ref._id ? String(ref._id) : String(ref))),
    tags: p.tags || [],

    specs: buildSpecs(attributes, context),
    selections: buildSelections(attributes, context),
  };
}

module.exports = {
  toPublicProduct,
  buildSpecs,
  buildSelections,
  buildOptions,
  renderTemplate,
  attributesToObject,
};
