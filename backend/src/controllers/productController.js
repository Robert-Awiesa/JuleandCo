const asyncHandler = require("express-async-handler");
const Product = require("../models/Product");
const Subcategory = require("../models/Subcategory");

// @desc    Get products with optional multi-facet filtering
// @route   GET /api/products
// @access  Public
const getProducts = asyncHandler(async (req, res) => {
  const {
    category,
    frameShape,
    lensColor,
    size,
    fabric,
    minPrice,
    maxPrice,
    search,
    sort,
  } = req.query;

  const query = {};

  if (category && category !== "all") query.category = category;
  if (frameShape) query.frameShape = { $in: frameShape.split(",") };
  if (lensColor) query.lensColor = { $in: lensColor.split(",") };
  if (size) query.clothingSize = { $in: size.split(",") };
  if (fabric) query.fabric = { $regex: fabric, $options: "i" };
  if (search) query.$text = { $search: search };

  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = Number(minPrice);
    if (maxPrice) query.price.$lte = Number(maxPrice);
  }

  let sortOption = { createdAt: -1 };
  if (sort === "price-asc") sortOption = { price: 1 };
  if (sort === "price-desc") sortOption = { price: -1 };
  if (sort === "new") sortOption = { isNew: -1, createdAt: -1 };
  if (sort === "bestseller") sortOption = { isBestSeller: -1, createdAt: -1 };

  const products = await Product.find(query).sort(sortOption);
  res.json(products);
});

// @desc    Get single product by slug
// @route   GET /api/products/slug/:slug
// @access  Public
const getProductBySlug = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug }).populate(
    "pairsWith",
    "name slug price images category subCategory"
  );

  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  res.json(product);
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

module.exports = {
  getProducts,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
  getAdminProducts,
  getAdminProductById,
  updateProductStock,
};
