const express = require("express");
const {
  getCustomers,
  getCustomer,
  getCustomerStats,
} = require("../controllers/customerController");
const { protect, admin } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protect, admin, getCustomers);

// Above /:email, which would otherwise swallow "stats".
router.get("/stats", protect, admin, getCustomerStats);

router.get("/:email", protect, admin, getCustomer);

module.exports = router;
