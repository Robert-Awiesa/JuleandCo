const asyncHandler = require("express-async-handler");
const SiteContent = require("../models/SiteContent");
const { validateMenuLinks } = require("../utils/navLinks");
const {
  SLOT_KEYS,
  isSlot,
  normaliseSlotData,
  slotDescriptors,
  defaultsFor,
} = require("../utils/contentSlots");

/**
 * Reads one slot, falling back to the declared default.
 *
 * The fallback is the point: the storefront renders the same site whether or
 * not anything has been saved, so shipping this could not blank the homepage,
 * and a slot added later works before anyone opens the admin.
 */
async function readSlot(slot) {
  const stored = await SiteContent.findOne({ slot }).lean();
  return stored?.data ?? defaultsFor(slot);
}

// @desc    All content, keyed by slot
// @route   GET /api/content
// @access  Public
const getAllContent = asyncHandler(async (req, res) => {
  const stored = await SiteContent.find({ slot: { $in: SLOT_KEYS } }).lean();
  const bySlot = new Map(stored.map((doc) => [doc.slot, doc.data]));

  const content = {};
  SLOT_KEYS.forEach((slot) => {
    content[slot] = bySlot.get(slot) ?? defaultsFor(slot);
  });

  res.json(content);
});

// @desc    One slot's content
// @route   GET /api/content/:slot
// @access  Public
const getContent = asyncHandler(async (req, res) => {
  const { slot } = req.params;
  if (!isSlot(slot)) {
    res.status(404);
    throw new Error(`"${slot}" is not a content slot`);
  }

  res.json({ slot, data: await readSlot(slot) });
});

// @desc    The shape of every slot, for building the admin editors
// @route   GET /api/content/meta/slots
// @access  Private/Admin
const getSlotDescriptors = asyncHandler(async (req, res) => {
  const stored = await SiteContent.find({}, "slot updatedAt updatedBy").lean();
  const meta = new Map(stored.map((doc) => [doc.slot, doc]));

  res.json(
    slotDescriptors().map((descriptor) => ({
      ...descriptor,
      // "Never edited" is worth showing: it means the storefront is still
      // rendering the built-in default.
      updatedAt: meta.get(descriptor.slot)?.updatedAt ?? null,
      updatedBy: meta.get(descriptor.slot)?.updatedBy ?? null,
    }))
  );
});

// @desc    Replace one slot's content
// @route   PUT /api/content/:slot
// @access  Private/Admin
const updateContent = asyncHandler(async (req, res) => {
  const { slot } = req.params;
  if (!isSlot(slot)) {
    res.status(404);
    throw new Error(`"${slot}" is not a content slot`);
  }

  let data;
  try {
    data = normaliseSlotData(slot, req.body.data);
  } catch (err) {
    res.status(err.statusCode || 400);
    throw err;
  }

  /**
   * The menu's links are filter URLs, and a slug typed slightly wrong makes an
   * entry that can never return anything — the customer clicks and gets an
   * empty shop with nothing to explain it. Refused here rather than discovered
   * later. A link that is valid but currently empty is fine: the products come
   * later, and the count beside it already shows a zero.
   */
  if (slot === "nav.megaMenu") {
    const problems = await validateMenuLinks(data);
    if (problems.length > 0) {
      res.status(400);
      throw new Error(
        `${problems.length} menu ${problems.length === 1 ? "link points" : "links point"} at something that does not exist — ${problems.join("; ")}`
      );
    }
  }

  const saved = await SiteContent.findOneAndUpdate(
    { slot },
    { $set: { data, updatedBy: req.user?.email || req.user?.name } },
    { upsert: true, new: true }
  ).lean();

  res.json({ slot, data: saved.data, updatedAt: saved.updatedAt });
});

// @desc    Discard edits and go back to the built-in content
// @route   DELETE /api/content/:slot
// @access  Private/Admin
const resetContent = asyncHandler(async (req, res) => {
  const { slot } = req.params;
  if (!isSlot(slot)) {
    res.status(404);
    throw new Error(`"${slot}" is not a content slot`);
  }

  // Deleting the document rather than writing the defaults into it, so the slot
  // returns to genuinely un-edited and keeps tracking any later default change.
  await SiteContent.deleteOne({ slot });
  res.json({ slot, data: defaultsFor(slot) });
});

module.exports = {
  getAllContent,
  getContent,
  getSlotDescriptors,
  updateContent,
  resetContent,
};
