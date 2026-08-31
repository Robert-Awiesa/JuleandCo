const asyncHandler = require("express-async-handler");
const AttributeGroup = require("../models/AttributeGroup");
const Attribute = require("../models/Attribute");
const { countProductsUsingGroup } = require("../utils/attributeUsage");

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

  const existing = await AttributeGroup.findById(req.params.id);
  if (!existing) {
    res.status(404);
    throw new Error("Attribute group not found");
  }

  /**
   * A list-backed group cannot become a free field while it still has options.
   *
   * "select"/"multiselect" draw from the vocabulary; "text"/"number" do not. So
   * switching away hides every option from the form while products keep
   * referencing them — the values stay in the database, unreachable and
   * un-editable, which is worse than being refused.
   */
  const wasList = ["select", "multiselect"].includes(existing.inputType);
  const willBeList = ["select", "multiselect"].includes(safe.inputType ?? existing.inputType);

  if (wasList && !willBeList) {
    const optionCount = await Attribute.countDocuments({ group: existing.key });
    if (optionCount > 0) {
      res.status(409);
      throw new Error(
        `"${existing.label}" still has ${optionCount} option(s). Remove them before ` +
          `changing how it is entered, or those options become unreachable.`
      );
    }
  }

  const group = await AttributeGroup.findByIdAndUpdate(req.params.id, safe, {
    new: true,
    runValidators: true,
  });
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

  // Counts variant-axis use as well as specs — a group used only as an axis
  // does not appear in `attributes` at all.
  const productCount = await countProductsUsingGroup(group.key);
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
