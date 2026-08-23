const express = require("express");
const {
  getReviews,
  moderateReview,
  deleteReview,
} = require("../controllers/reviewController");
const { protect, admin } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protect, admin, getReviews);
router.patch("/:id", protect, admin, moderateReview);
router.delete("/:id", protect, admin, deleteReview);

module.exports = router;
