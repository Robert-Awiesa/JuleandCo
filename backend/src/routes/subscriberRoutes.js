const express = require("express");
const {
  subscribe,
  getSubscribers,
  unsubscribe,
} = require("../controllers/subscriberController");
const { protect, admin } = require("../middleware/authMiddleware");
const limits = require("../middleware/rateLimit");

const router = express.Router();

router
  .route("/")
  // Public and unauthenticated, so it is limited like the other open write
  // endpoints — an unbounded signup form is a way to fill the list with noise.
  .post(limits.review, subscribe)
  .get(protect, admin, getSubscribers);

router.delete("/:id", protect, admin, unsubscribe);

module.exports = router;
