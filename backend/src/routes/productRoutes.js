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
  getAdminProductById,
  updateProductStock,
} = require("../controllers/productController");
const { protect, admin } = require("../middleware/authMiddleware");

const router = express.Router();

router.route("/").get(getProducts).post(protect, admin, createProduct);

router.get("/facets", getProductFacets);
router.get("/admin", protect, admin, getAdminProducts);
router.get("/id/:id", protect, admin, getAdminProductById);
router.get("/slug/:slug", getProductBySlug);

// Declared before /:id so "bulk" is never parsed as a product id.
router.patch("/bulk", protect, admin, bulkUpdateProducts);

router.route("/:id").put(protect, admin, updateProduct).delete(protect, admin, deleteProduct);
router.patch("/:id/stock", protect, admin, updateProductStock);
router.post("/:id/duplicate", protect, admin, duplicateProduct);

module.exports = router;
