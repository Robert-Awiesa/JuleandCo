const express = require("express");
const {
  getCategories,
  getCategoryBySlug,
  createCategory,
} = require("../controllers/categoryController");
const { protect, admin } = require("../middleware/authMiddleware");

const router = express.Router();

router.route("/").get(getCategories).post(protect, admin, createCategory);
router.get("/:slug", getCategoryBySlug);

module.exports = router;
