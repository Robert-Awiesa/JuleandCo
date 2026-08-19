const asyncHandler = require("express-async-handler");
const Attribute = require("../models/Attribute");
const Product = require("../models/Product");

// Which product field each vocabulary group feeds. Used to block deletion of an
// option that products still reference.
const GROUP_USAGE = {
  frameShape: (value) => ({ frameShape: value }),
  lensType: (value) => ({ lensOptions: value }),
  frameMaterial: (value) => ({ frameMaterial: value }),
  fabric: (value) => ({ fabric: value }),
  clothingSize: (value) => ({ clothingSize: value }),
  fit: (value) => ({ fit: value }),
  gender: (value) => ({ gender: value }),
};

// @desc    List vocabulary options, optionally narrowed to one group/category
// @route   GET /api/attributes
// @access  Public (the storefront's filters read this too)
const getAttributes = asyncHandler(async (req, res) => {
  const { group, categoryType } = req.query;
  const query = {};
  if (group) query.group = group;
  if (categoryType) {
    // An option with no categoryType applies everywhere.
    query.$or = [{ categoryType }, { categoryType: { $exists: false } }, { categoryType: null }];
  }
  const attributes = await Attribute.find(query).sort({ group: 1, sortOrder: 1, label: 1 });
  res.json(attributes);
});

// @desc    Create a vocabulary option
// @route   POST /api/attributes
// @access  Private/Admin
const createAttribute = asyncHandler(async (req, res) => {
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
  const attribute = await Attribute.findByIdAndUpdate(req.params.id, req.body, {
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

  const buildQuery = GROUP_USAGE[attribute.group];
  if (buildQuery) {
    const inUse = await Product.countDocuments(buildQuery(attribute.value));
    if (inUse > 0) {
      res.status(409);
      throw new Error(`Cannot delete "${attribute.label}" — ${inUse} product(s) still use it`);
    }
  }

  await attribute.deleteOne();
  res.json({ message: "Attribute removed" });
});

module.exports = { getAttributes, createAttribute, updateAttribute, deleteAttribute };
