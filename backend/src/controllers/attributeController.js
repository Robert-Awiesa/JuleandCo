const asyncHandler = require("express-async-handler");
const Attribute = require("../models/Attribute");
const AttributeGroup = require("../models/AttributeGroup");
const { countProductsUsing, usageByValue } = require("../utils/attributeUsage");

// @desc    List vocabulary options, optionally narrowed to one group or category
// @route   GET /api/attributes
// @access  Public (the storefront's filters read this too)
const getAttributes = asyncHandler(async (req, res) => {
  const { group, category } = req.query;
  const query = {};

  if (group) {
    query.group = group;
  } else if (category) {
    // Category binding lives on the group, not on individual options.
    const groups = await AttributeGroup.find({
      $or: [{ categories: category }, { categories: { $size: 0 } }],
    })
      .select("key")
      .lean();
    query.group = { $in: groups.map((g) => g.key) };
  }

  const attributes = await Attribute.find(query).sort({ group: 1, sortOrder: 1, label: 1 });
  res.json(attributes);
});

// @desc    Create a vocabulary option
// @route   POST /api/attributes
// @access  Private/Admin
const createAttribute = asyncHandler(async (req, res) => {
  const groupExists = await AttributeGroup.exists({ key: req.body.group });
  if (!groupExists) {
    res.status(400);
    throw new Error(`"${req.body.group}" is not a known attribute group`);
  }

  const existing = await Attribute.findOne({ group: req.body.group, value: req.body.value });
  if (existing) {
    res.status(409);
    throw new Error(`"${req.body.value}" already exists in ${req.body.group}`);
  }

  const attribute = await Attribute.create(req.body);
  res.status(201).json(attribute);
});

// @desc    Update a vocabulary option
// @route   PUT /api/attributes/:id
// @access  Private/Admin
const updateAttribute = asyncHandler(async (req, res) => {
  // `value` is what products store; changing it would orphan them silently.
  const { value, group, ...safe } = req.body;

  const attribute = await Attribute.findByIdAndUpdate(req.params.id, safe, {
    new: true,
    runValidators: true,
  });
  if (!attribute) {
    res.status(404);
    throw new Error("Attribute not found");
  }
  res.json(attribute);
});

// @desc    Delete a vocabulary option, unless products still use it
// @route   DELETE /api/attributes/:id
// @access  Private/Admin
const deleteAttribute = asyncHandler(async (req, res) => {
  const attribute = await Attribute.findById(req.params.id);
  if (!attribute) {
    res.status(404);
    throw new Error("Attribute not found");
  }

  const inUse = await countProductsUsing(attribute.group, attribute.value);
  if (inUse > 0) {
    res.status(409);
    throw new Error(`Cannot delete "${attribute.label}" — ${inUse} product(s) still use it`);
  }

  await attribute.deleteOne();
  res.json({ message: "Attribute removed" });
});

// @desc    How many products use each vocabulary value
// @route   GET /api/attributes/usage
// @access  Private/Admin
//
// So the admin can show what an option costs to remove *before* asking, rather
// than only refusing afterwards — and so unused options are visible as
// candidates for tidying.
const getAttributeUsage = asyncHandler(async (req, res) => {
  res.json(await usageByValue());
});

module.exports = {
  getAttributes,
  getAttributeUsage,
  createAttribute,
  updateAttribute,
  deleteAttribute,
};
