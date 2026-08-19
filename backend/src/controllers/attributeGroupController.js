const asyncHandler = require("express-async-handler");
const AttributeGroup = require("../models/AttributeGroup");
const Attribute = require("../models/Attribute");
const Product = require("../models/Product");

// @desc    List attribute groups, optionally for one category
// @route   GET /api/attribute-groups
// @access  Public (the storefront needs labels and filter styles)
const getAttributeGroups = asyncHandler(async (req, res) => {
  const { category, role } = req.query;
  const query = {};

  // A group with no categories applies to all of them.
  if (category && category !== "all") {
    query.$or = [{ categories: category }, { categories: { $size: 0 } }];
  }
  if (role) query.role = role;

  const groups = await AttributeGroup.find(query).sort({ sortOrder: 1, label: 1 });
  res.json(groups);
});

// @desc    Create an attribute group
// @route   POST /api/attribute-groups
// @access  Private/Admin
const createAttributeGroup = asyncHandler(async (req, res) => {
  const existing = await AttributeGroup.findOne({ key: req.body.key });
  if (existing) {
    res.status(409);
    throw new Error(`An attribute group with the key "${req.body.key}" already exists`);
  }

  const group = await AttributeGroup.create(req.body);
  res.status(201).json(group);
});

// @desc    Update an attribute group
// @route   PUT /api/attribute-groups/:id
// @access  Private/Admin
const updateAttributeGroup = asyncHandler(async (req, res) => {
  // `key` is the path products store their values under; renaming it would
  // orphan every product using the group.
  const { key, ...safe } = req.body;

  const group = await AttributeGroup.findByIdAndUpdate(req.params.id, safe, {
    new: true,
    runValidators: true,
  });
  if (!group) {
    res.status(404);
    throw new Error("Attribute group not found");
  }
  res.json(group);
});

// @desc    Delete an attribute group, unless it has options or products using it
// @route   DELETE /api/attribute-groups/:id
// @access  Private/Admin
const deleteAttributeGroup = asyncHandler(async (req, res) => {
  const group = await AttributeGroup.findById(req.params.id);
  if (!group) {
    res.status(404);
    throw new Error("Attribute group not found");
  }

  const optionCount = await Attribute.countDocuments({ group: group.key });
  if (optionCount > 0) {
    res.status(409);
    throw new Error(
      `Cannot delete "${group.label}" — remove its ${optionCount} option(s) first`
    );
  }

  const productCount = await Product.countDocuments({
    [`attributes.${group.key}`]: { $exists: true },
  });
  if (productCount > 0) {
    res.status(409);
    throw new Error(`Cannot delete "${group.label}" — ${productCount} product(s) still use it`);
  }

  await group.deleteOne();
  res.json({ message: "Attribute group removed" });
});

module.exports = {
  getAttributeGroups,
  createAttributeGroup,
  updateAttributeGroup,
  deleteAttributeGroup,
};
