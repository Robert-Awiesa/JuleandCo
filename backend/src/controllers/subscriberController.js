const asyncHandler = require("express-async-handler");
const Subscriber = require("../models/Subscriber");

/** Good enough to catch a typo; the real test is whether mail arrives. */
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// @desc    Join the mailing list
// @route   POST /api/subscribers
// @access  Public
const subscribe = asyncHandler(async (req, res) => {
  const email = String(req.body.email || "").toLowerCase().trim();

  if (!LOOKS_LIKE_EMAIL.test(email)) {
    res.status(400);
    throw new Error("That does not look like an email address");
  }

  /**
   * Signing up twice is not an error.
   *
   * Someone who cannot remember whether they already joined will simply do it
   * again, and telling them "you are already subscribed" is both unhelpful and
   * a way of confirming to a stranger which addresses are on the list.
   *
   * An upsert also un-does a previous unsubscribe only when they ask again,
   * which is what a second deliberate signup means.
   */
  await Subscriber.updateOne(
    { email },
    {
      $set: { unsubscribedAt: null },
      $setOnInsert: { email, source: String(req.body.source || "footer").slice(0, 40) },
    },
    { upsert: true }
  );

  res.status(201).json({ message: "You are on the list" });
});

// @desc    Everyone on the list
// @route   GET /api/subscribers
// @access  Private/Admin
const getSubscribers = asyncHandler(async (req, res) => {
  const subscribers = await Subscriber.find({ unsubscribedAt: null })
    .sort({ createdAt: -1 })
    .lean();

  res.json({
    total: subscribers.length,
    items: subscribers.map((s) => ({
      _id: s._id,
      email: s.email,
      source: s.source,
      createdAt: s.createdAt,
    })),
  });
});

// @desc    Take someone off the list
// @route   DELETE /api/subscribers/:id
// @access  Private/Admin
const unsubscribe = asyncHandler(async (req, res) => {
  const subscriber = await Subscriber.findById(req.params.id);
  if (!subscriber) {
    res.status(404);
    throw new Error("Not on the list");
  }

  // Marked, not deleted — a deleted address is re-added by the next form
  // submission and starts receiving mail again.
  subscriber.unsubscribedAt = new Date();
  await subscriber.save();

  res.json({ message: "Removed from the list" });
});

module.exports = { subscribe, getSubscribers, unsubscribe };
