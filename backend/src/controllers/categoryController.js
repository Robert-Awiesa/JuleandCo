const asyncHandler = require("express-async-handler");
const Category = require("../models/Category");
const Subcategory = require("../models/Subcategory");
const Product = require("../models/Product");
const AttributeGroup = require("../models/AttributeGroup");

// @desc    List categories
// @route   GET /api/categories
// @access  Public
const getCategories = asyncHandler(async (req, res) => {
  const query = {};
  // The storefront asks for active only; the admin wants retired ones too.
  if (req.query.activeOnly === "true") query.isActive = true;

  const categories = await Category.find(query).sort({ sortOrder: 1, name: 1 });
  res.json(categories);
});

// @desc    Get one category by slug
// @route   GET /api/categories/:slug
// @access  Public
const getCategoryBySlug = asyncHandler(async (req, res) => {
  const category = await Category.findOne({ slug: req.params.slug });
  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }
  res.json(category);
});

// @desc    Create a category
// @route   POST /api/categories
// @access  Private/Admin
const createCategory = asyncHandler(async (req, res) => {
  const existing = await Category.findOne({ slug: req.body.slug });
  if (existing) {
    res.status(409);
    throw new Error(`A category with the slug "${req.body.slug}" already exists`);
  }

  const category = await Category.create(req.body);
  res.status(201).json(category);
});

// @desc    Update a category
// @route   PUT /api/categories/:id
// @access  Private/Admin
const updateCategory = asyncHandler(async (req, res) => {
  // `slug` is what products and sub-categories key off; renaming it would
  // detach the whole category. Retire via isActive instead.
  const { slug, ...safe } = req.body;

  const category = await Category.findByIdAndUpdate(req.params.id, safe, {
    new: true,
    runValidators: true,
  });
  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }
  res.json(category);
});

// @desc    Delete a category, unless products or sub-categories still use it
// @route   DELETE /api/categories/:id
// @access  Private/Admin
const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }

  const productCount = await Product.countDocuments({ category: category.slug });
  if (productCount > 0) {
    res.status(409);
    throw new Error(
      `Cannot delete "${category.name}" — ${productCount} product(s) still use it. ` +
        `Set it inactive to hide it from the storefront without losing them.`
    );
  }

  const subCount = await Subcategory.countDocuments({ categoryType: category.slug });
  if (subCount > 0) {
    res.status(409);
    throw new Error(`Cannot delete "${category.name}" — remove its ${subCount} sub-categories first`);
  }

  /**
   * Attribute groups that name this category and nothing else.
   *
   * An empty `categories` list means "applies to every category", so simply
   * pulling the slug out would not orphan these groups — it would do something
   * worse and quieter: a Fabric field would start appearing on eyewear, and a
   * Frame Shape filter on bags. Refused rather than silently widened, and the
   * groups are named so it is obvious what to reassign.
   */
  const orphaned = await AttributeGroup.find({ categories: [category.slug] })
    .select("label")
    .lean();

  if (orphaned.length > 0) {
    res.status(409);
    throw new Error(
      `Cannot delete "${category.name}" — ${orphaned.length} attribute group(s) apply to it ` +
        `and nothing else (${orphaned.map((g) => g.label).join(", ")}). ` +
        `Reassign or delete them first, or they would start applying to every category.`
    );
  }

  // Groups that also cover other categories just lose this one.
  await AttributeGroup.updateMany(
    { categories: category.slug },
    { $pull: { categories: category.slug } }
  );

  await category.deleteOne();
  res.json({ message: "Category removed" });
});

module.exports = {
  getCategories,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  deleteCategory,
};
