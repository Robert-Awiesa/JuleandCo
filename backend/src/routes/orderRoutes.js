const express = require("express");
const {
  createOrder,
  getOrders,
  getOrderStats,
  getMyOrders,
  getOrderById,
  updateOrderStatus,
} = require("../controllers/orderController");
const { protect, admin } = require("../middleware/authMiddleware");

const router = express.Router();

router
  .route("/")
  // Public: checkout is guest-only, since the storefront has no accounts.
  // Prices and stock are resolved server-side, so nothing here is trusted.
  .post(createOrder)
  .get(protect, admin, getOrders);

// Above /:id so "stats" and "mine" are not parsed as order ids.
router.get("/stats", protect, admin, getOrderStats);
router.get("/mine", protect, getMyOrders);

router.get("/:id", protect, getOrderById);
router.put("/:id/status", protect, admin, updateOrderStatus);

module.exports = router;
