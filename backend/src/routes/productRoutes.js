const express = require("express");
const {
  getProducts,
  getProductFacets,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
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

router.route("/:id").put(protect, admin, updateProduct).delete(protect, admin, deleteProduct);
router.patch("/:id/stock", protect, admin, updateProductStock);

module.exports = router;
