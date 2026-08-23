const express = require("express");
const {
  getProducts,
  getProductFacets,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
  duplicateProduct,
  bulkUpdateProducts,
  getAdminProducts,
  getProductStats,
  getProductsNeedingAttention,
  getAdminProductById,
  updateProductStock,
} = require("../controllers/productController");
const { getProductReviews, createReview } = require("../controllers/reviewController");
const { protect, admin } = require("../middleware/authMiddleware");

const router = express.Router();

router.route("/").get(getProducts).post(protect, admin, createProduct);

router.get("/facets", getProductFacets);
router.get("/admin", protect, admin, getAdminProducts);
router.get("/stats", protect, admin, getProductStats);
router.get("/attention", protect, admin, getProductsNeedingAttention);
router.get("/id/:id", protect, admin, getAdminProductById);
router.get("/slug/:slug", getProductBySlug);

// Declared before /:id so "bulk" is never parsed as a product id.
router.patch("/bulk", protect, admin, bulkUpdateProducts);

router.route("/:id").put(protect, admin, updateProduct).delete(protect, admin, deleteProduct);
router.patch("/:id/stock", protect, admin, updateProductStock);
router.post("/:id/duplicate", protect, admin, duplicateProduct);

// Public: anyone who bought a piece can say what they think of it.
router.route("/:id/reviews").get(getProductReviews).post(createReview);

module.exports = router;
