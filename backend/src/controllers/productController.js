const asyncHandler = require("express-async-handler");
const Product = require("../models/Product");

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
  const product = await Product.create(req.body);
  res.status(201).json(product);
});

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin
const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  res.json(product);
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

module.exports = {
  getProducts,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
};
