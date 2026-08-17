const asyncHandler = require("express-async-handler");
const Subcategory = require("../models/Subcategory");
const Product = require("../models/Product");

const getSubcategories = asyncHandler(async (req, res) => {
  const { categoryType } = req.query;
  const query = {};
  if (categoryType) query.categoryType = categoryType;
  const subcategories = await Subcategory.find(query).sort({ sortOrder: 1, name: 1 });
  res.json(subcategories);
});

const createSubcategory = asyncHandler(async (req, res) => {
  const subcategory = await Subcategory.create(req.body);
  res.status(201).json(subcategory);
});

const updateSubcategory = asyncHandler(async (req, res) => {
  const subcategory = await Subcategory.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!subcategory) {
    res.status(404);
    throw new Error("Sub-category not found");
  }
  res.json(subcategory);
});

const deleteSubcategory = asyncHandler(async (req, res) => {
  const subcategory = await Subcategory.findById(req.params.id);
  if (!subcategory) {
    res.status(404);
    throw new Error("Sub-category not found");
  }

  const productCount = await Product.countDocuments({
    subCategory: subcategory.slug,
    category: subcategory.categoryType,
  });
  if (productCount > 0) {
    res.status(409);
    throw new Error(
      `Cannot delete "${subcategory.name}" — ${productCount} product(s) still use it`
    );
  }

  await subcategory.deleteOne();
  res.json({ message: "Sub-category removed" });
});

module.exports = { getSubcategories, createSubcategory, updateSubcategory, deleteSubcategory };
