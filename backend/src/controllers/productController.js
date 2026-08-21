const asyncHandler = require("express-async-handler");
const Product = require("../models/Product");
const Subcategory = require("../models/Subcategory");
const Category = require("../models/Category");
const Attribute = require("../models/Attribute");
const AttributeGroup = require("../models/AttributeGroup");
const { toPublicProduct } = require("../utils/publicProduct");
const { buildCatalogContext } = require("../utils/catalogContext");

/** Reserved query params that are not attribute filters. */
const NON_ATTRIBUTE_PARAMS = new Set([
  "category",
  "subCategory",
  "minPrice",
  "maxPrice",
  "search",
  "sort",
  "page",
  "limit",
]);

const csv = (v) => String(v).split(",").filter(Boolean);

/**
 * Builds the attribute part of a product query from whatever filterable groups
 * exist. This replaced a hand-written `if (frameShape) … if (fabric) …` block,
 * which meant every new filter was a code change in this file plus four others.
 */
async function buildAttributeFilters(query) {
  const groups = await AttributeGroup.find({ showInFilters: true }, "key").lean();
  const filters = {};

  groups.forEach(({ key }) => {
    const value = query[key];
    if (!value || NON_ATTRIBUTE_PARAMS.has(key)) return;
    // $in matches scalars and array members alike, so multiselect groups
    // (lens options, sizes offered) need no special handling.
    filters[`attributes.${key}`] = { $in: csv(value) };
  });

  return filters;
}

/**
 * Category and sub-category are validated here rather than by a schema enum.
 * The enum was a hard write gate that made adding a category a code change.
 */
async function assertValidCategorisation(categorySlug, subCategorySlug) {
  const category = await Category.findOne({ slug: categorySlug });
  if (!category) {
    const error = new Error(`"${categorySlug}" is not a known category`);
    error.statusCode = 400;
    throw error;
  }

  const subcategory = await Subcategory.findOne({
    slug: subCategorySlug,
    categoryType: categorySlug,
  });
  if (!subcategory) {
    const error = new Error(
      `"${subCategorySlug}" is not a valid sub-category for "${categorySlug}"`
    );
    error.statusCode = 400;
    throw error;
  }
}

// @desc    Get products with optional multi-facet filtering
// @route   GET /api/products
// @access  Public
const getProducts = asyncHandler(async (req, res) => {
  const { category, subCategory, minPrice, maxPrice, search, sort } = req.query;

  // Draft products must never reach the storefront.
  const query = { publishStatus: "published" };

  if (category && category !== "all") query.category = category;
  if (subCategory) query.subCategory = { $in: csv(subCategory) };
  if (search) query.$text = { $search: search };

  Object.assign(query, await buildAttributeFilters(req.query));

  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = Number(minPrice);
    if (maxPrice) query.price.$lte = Number(maxPrice);
  }

  let sortOption = { createdAt: -1 };
  if (sort === "price-asc") sortOption = { price: 1 };
  if (sort === "price-desc") sortOption = { price: -1 };
  if (sort === "new") sortOption = { isNewArrival: -1, createdAt: -1 };
  if (sort === "bestseller") sortOption = { isBestSeller: -1, createdAt: -1 };

  const [products, context] = await Promise.all([
    Product.find(query).sort(sortOption),
    buildCatalogContext(),
  ]);

  res.json(products.map((p) => toPublicProduct(p, context.forProduct(p))));
});

// @desc    Get single product by slug
// @route   GET /api/products/slug/:slug
// @access  Public
const getProductBySlug = asyncHandler(async (req, res) => {
  const product = await Product.findOne({
    slug: req.params.slug,
    publishStatus: "published",
  });

  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  // "Complete the Look" needs whole products, not just ids — and a paired
  // product that has since been unpublished must not surface.
  const [related, context] = await Promise.all([
    Product.find({ _id: { $in: product.pairsWith || [] }, publishStatus: "published" }),
    buildCatalogContext(),
  ]);

  res.json({
    ...toPublicProduct(product, context.forProduct(product)),
    related: related.map((p) => toPublicProduct(p, context.forProduct(p))),
  });
});

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
const createProduct = asyncHandler(async (req, res) => {
  try {
    await assertValidCategorisation(req.body.category, req.body.subCategory);
  } catch (err) {
    res.status(err.statusCode || 400);
    throw err;
  }

  const product = await Product.create(req.body);
  res.status(201).json(product);
});

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin
const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  const nextCategory = req.body.category || product.category;
  const nextSubCategory = req.body.subCategory || product.subCategory;
  if (req.body.category || req.body.subCategory) {
    try {
      await assertValidCategorisation(nextCategory, nextSubCategory);
    } catch (err) {
      res.status(err.statusCode || 400);
      throw err;
    }
  }

  Object.assign(product, req.body, { category: nextCategory, subCategory: nextSubCategory });
  const updated = await product.save();
  res.json(updated);
});

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Admin
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  res.json({ message: "Product removed" });
});

// @desc    Get paginated/filterable product list for the admin dashboard
// @route   GET /api/products/admin
// @access  Private/Admin
const getAdminProducts = asyncHandler(async (req, res) => {
  const { category, subCategory, stockStatus, search, page = 1, limit = 20 } = req.query;
  const query = {};

  if (category && category !== "all") query.category = category;
  if (subCategory) query.subCategory = subCategory;
  if (search) query.$text = { $search: search };
  if (stockStatus === "out") query.stock = 0;
  if (stockStatus === "low") query.stock = { $gt: 0, $lte: 5 };
  if (stockStatus === "in") query.stock = { $gt: 5 };

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.max(1, Number(limit));

  const [items, total] = await Promise.all([
    Product.find(query)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    Product.countDocuments(query),
  ]);

  res.json({
    items,
    total,
    page: pageNum,
    pages: Math.max(1, Math.ceil(total / limitNum)),
  });
});

// @desc    Get a single product by Mongo id (admin editing — the public route only supports slug)
// @route   GET /api/products/id/:id
// @access  Private/Admin
const getAdminProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }
  res.json(product);
});

// @desc    Update stock for specific variants without resending the whole product
// @route   PATCH /api/products/:id/stock
// @access  Private/Admin
const updateProductStock = asyncHandler(async (req, res) => {
  const { variants } = req.body;
  if (!Array.isArray(variants) || variants.length === 0) {
    res.status(400);
    throw new Error("variants array is required");
  }

  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  const updates = new Map(variants.map((v) => [v.id, v.stock]));
  product.variants.forEach((variant) => {
    if (updates.has(variant.id)) {
      variant.stock = Math.max(0, Number(updates.get(variant.id)) || 0);
    }
  });

  const updated = await product.save();
  res.json(updated);
});

// @desc    Filter facets actually present in the published catalogue
// @route   GET /api/products/facets
// @access  Public
const getProductFacets = asyncHandler(async (req, res) => {
  const { category } = req.query;
  const match = { publishStatus: "published" };
  if (category && category !== "all") match.category = category;

  // Which groups to aggregate is now read from the data, so a new facet needs
  // no aggregation edit here.
  const filterGroups = await AttributeGroup.find({ showInFilters: true }).lean();
  const applicable = filterGroups.filter(
    (g) => !category || category === "all" || !g.categories?.length || g.categories.includes(category)
  );

  /**
   * One sub-pipeline per group, so every option comes back with how many
   * products carry it. $addToSet alone gave distinct values but no counts,
   * which is what the navigation needs to show "Aviator (3)".
   *
   * $unwind handles both shapes a value can take: multiselect groups store an
   * array, single-select groups store a scalar, and Mongo treats a non-array
   * as a one-element array here. Documents missing the field drop out, which
   * is what we want.
   */
  const facetStage = {
    subCategory: [{ $group: { _id: "$subCategory", n: { $sum: 1 } } }],
    priceBounds: [{ $group: { _id: null, min: { $min: "$price" }, max: { $max: "$price" } } }],
  };
  applicable.forEach((group) => {
    facetStage[group.key] = [
      { $unwind: `$attributes.${group.key}` },
      { $group: { _id: `$attributes.${group.key}`, n: { $sum: 1 } } },
    ];
  });

  const [raw = {}] = await Product.aggregate([{ $match: match }, { $facet: facetStage }]);

  // Drops the nulls left by products that never set the attribute.
  const buckets = (key) =>
    (raw[key] || []).filter((b) => b._id !== null && b._id !== undefined && b._id !== "");

  const usedValues = applicable.flatMap((g) => buckets(g.key).map((b) => b._id));
  const attributes = usedValues.length
    ? await Attribute.find({ value: { $in: usedValues } }).lean()
    : [];

  // Callers read groups.<key>, so an empty catalogue must still return every key.
  const groups = Object.fromEntries(applicable.map((g) => [g.key, []]));
  const counts = {};

  applicable.forEach((group) => {
    const rows = buckets(group.key);
    counts[group.key] = Object.fromEntries(rows.map((b) => [b._id, b.n]));

    groups[group.key] = rows
      .map((b) => {
        const attr = attributes.find((a) => a.group === group.key && a.value === b._id);
        return {
          value: b._id,
          label: attr ? attr.label : String(b._id),
          hex: attr ? attr.hex : undefined,
          count: b.n,
          sortOrder: attr ? attr.sortOrder : 0,
        };
      })
      .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
  });

  const subCategoryRows = buckets("subCategory");
  counts.subCategory = Object.fromEntries(subCategoryRows.map((b) => [b._id, b.n]));

  const price = (raw.priceBounds || [])[0] || {};

  res.json({
    groups,
    // Lets the storefront render a facet it has never heard of, with the right
    // title and control style, without a matching JSX block being added.
    groupMeta: applicable
      .map(({ key, label, filterStyle, sortOrder }) => ({ key, label, filterStyle, sortOrder }))
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
    subCategories: subCategoryRows.map((b) => b._id).sort(),
    // value -> product count, keyed by group. Consumed by the navigation, which
    // needs a number per link without re-deriving it from `groups`.
    counts,
    priceBounds: [price.min ?? 0, price.max ?? 0],
  });
});

module.exports = {
  getProducts,
  getProductFacets,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
  getAdminProducts,
  getAdminProductById,
  updateProductStock,
};
