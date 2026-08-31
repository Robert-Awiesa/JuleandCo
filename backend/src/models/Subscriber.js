const mongoose = require("mongoose");

/**
 * Someone who asked to hear from the shop.
 *
 * The footer has always carried an email field with a "Join" button that
 * answered "Thanks!" — and then discarded the address. Nobody who signed up was
 * ever going to hear anything, which is worse than not offering it at all: the
 * customer believes they are on a list that does not exist.
 *
 * Deliberately minimal. An address and where it came from is enough to send a
 * mailing; anything more is data we would have to justify holding.
 */
const subscriberSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // Which part of the site it came from, so a future signup point can be
    // told apart from the footer without guessing.
    source: { type: String, default: "footer" },

    /**
     * Unsubscribing keeps the row rather than deleting it.
     *
     * A deleted address can be re-added by the next form submission and start
     * receiving mail again. A record of the request is what makes "no" stick.
     */
    unsubscribedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Subscriber", subscriberSchema);
