const asyncHandler = require("express-async-handler");
const Product = require("../models/Product");
const Subcategory = require("../models/Subcategory");
const Attribute = require("../models/Attribute");
const { toPublicProduct } = require("../utils/publicProduct");
const { buildLabelMap } = require("../utils/labelMap");

// @desc    Get products with optional multi-facet filtering
// @route   GET /api/products
// @access  Public
const getProducts = asyncHandler(async (req, res) => {
  const {
    category,
    frameShape,
    frameMaterial,
    lensType,
    gender,
    fit,
    lensColor,
    size,
    fabric,
    subCategory,
    minPrice,
    maxPrice,
    search,
    sort,
  } = req.query;

  // Draft products must never reach the storefront.
  const query = { publishStatus: "published" };

  const csv = (v) => String(v).split(",").filter(Boolean);

  if (category && category !== "all") query.category = category;
  if (subCategory) query.subCategory = { $in: csv(subCategory) };
  if (frameShape) query.frameShape = { $in: csv(frameShape) };
  if (frameMaterial) query.frameMaterial = { $in: csv(frameMaterial) };
  if (lensType) query.lensOptions = { $in: csv(lensType) };
  if (gender) query.gender = { $in: csv(gender) };
  if (fit) query.fit = { $in: csv(fit) };
  if (lensColor) query.lensColor = { $in: csv(lensColor) };
  if (size) query.clothingSize = { $in: csv(size) };
  if (fabric) query.fabric = { $in: csv(fabric) };
  if (search) query.$text = { $search: search };

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

  const [products, labels] = await Promise.all([
    Product.find(query).sort(sortOption),
    buildLabelMap(),
  ]);
  res.json(products.map((p) => toPublicProduct(p, labels)));
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
  const [related, labels] = await Promise.all([
    Product.find({ _id: { $in: product.pairsWith || [] }, publishStatus: "published" }),
    buildLabelMap(),
  ]);

  res.json({
    ...toPublicProduct(product, labels),
    related: related.map((p) => toPublicProduct(p, labels)),
  });
});

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
const createProduct = asyncHandler(async (req, res) => {
  const validSubcategory = await Subcategory.findOne({
    slug: req.body.subCategory,
    categoryType: req.body.category,
  });
  if (!validSubcategory) {
    res.status(400);
    throw new Error(
      `"${req.body.subCategory}" is not a valid sub-category for "${req.body.category}"`
    );
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
    const validSubcategory = await Subcategory.findOne({
      slug: nextSubCategory,
      categoryType: nextCategory,
    });
    if (!validSubcategory) {
      res.status(400);
      throw new Error(`"${nextSubCategory}" is not a valid sub-category for "${nextCategory}"`);
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

const FACET_GROUPS = ["frameShape", "frameMaterial", "lensType", "gender", "fit", "fabric", "clothingSize"];

// @desc    Filter facets actually present in the published catalogue
// @route   GET /api/products/facets
// @access  Public
const getProductFacets = asyncHandler(async (req, res) => {
  const { category } = req.query;
  const match = { publishStatus: "published" };
  if (category && category !== "all") match.category = category;

  const [raw] = await Product.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        frameShape: { $addToSet: "$frameShape" },
        frameMaterial: { $addToSet: "$frameMaterial" },
        lensType: { $addToSet: "$lensOptions" },
        gender: { $addToSet: "$gender" },
        fit: { $addToSet: "$fit" },
        fabric: { $addToSet: "$fabric" },
        clothingSize: { $addToSet: "$clothingSize" },
        subCategory: { $addToSet: "$subCategory" },
        minPrice: { $min: "$price" },
        maxPrice: { $max: "$price" },
      },
    },
  ]);

  // Callers destructure groups.<name>, so an empty catalogue must still return
  // every key rather than an empty object.
  const emptyGroups = Object.fromEntries(FACET_GROUPS.map((g) => [g, []]));

  if (!raw) {
    return res.json({ groups: emptyGroups, subCategories: [], priceBounds: [0, 0] });
  }

  // $addToSet over array fields (lensOptions, clothingSize) yields arrays of
  // arrays; flatten and drop the nulls left by products missing that field.
  const clean = (values) =>
    Array.from(new Set(values.flat().filter((v) => v !== null && v !== undefined && v !== "")));

  const usedValues = FACET_GROUPS.flatMap((g) => clean(raw[g]));
  const attributes = await Attribute.find({ value: { $in: usedValues } });

  const groups = { ...emptyGroups };
  FACET_GROUPS.forEach((group) => {
    groups[group] = clean(raw[group])
      .map((value) => {
        const attr = attributes.find((a) => a.group === group && a.value === value);
        return { value, label: attr ? attr.label : value, hex: attr ? attr.hex : undefined, sortOrder: attr ? attr.sortOrder : 0 };
      })
      .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
  });

  res.json({
    groups,
    subCategories: clean(raw.subCategory).sort(),
    priceBounds: [raw.minPrice ?? 0, raw.maxPrice ?? 0],
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
