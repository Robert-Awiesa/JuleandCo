const mongoose = require("mongoose");

/**
 * A customer's review of a piece.
 *
 * `rating` and `reviewCount` sat on Product from the beginning, were served to
 * the storefront, and were never rendered or editable — numbers promising a
 * feature that did not exist. They are now computed from these records and
 * never set by hand, so what a product claims is what customers actually said.
 *
 * Reviews arrive **pending** and show nowhere until an admin approves them. An
 * open review box on a small shop is a spam target, and a shop owner should
 * never discover what is on their own product page by reading it.
 */
const reviewSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },

    author: { type: String, required: true, trim: true },
    // Identifies the reviewer and is how a purchase is matched. Never published.
    email: { type: String, required: true, lowercase: true, trim: true },

    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, trim: true },
    body: { type: String, required: true, trim: true },

    /**
     * Whether this email has actually bought this piece. Worked out when the
     * review is written rather than on display: an order cancelled later does
     * not retract what was true when they wrote it.
     */
    verifiedPurchase: { type: Boolean, default: false },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true }
);

// One review per person per piece — otherwise a rating is whoever posts most.
reviewSchema.index({ product: 1, email: 1 }, { unique: true });

// The admin's queue is "oldest pending first": the one kept waiting longest.
reviewSchema.index({ status: 1, createdAt: 1 });

module.exports = mongoose.model("Review", reviewSchema);
