const express = require("express");
const {
  getSubcategories,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory,
} = require("../controllers/subcategoryController");
const { protect, admin } = require("../middleware/authMiddleware");

const router = express.Router();

router.route("/").get(getSubcategories).post(protect, admin, createSubcategory);
router
  .route("/:id")
  .put(protect, admin, updateSubcategory)
  .delete(protect, admin, deleteSubcategory);

module.exports = router;
