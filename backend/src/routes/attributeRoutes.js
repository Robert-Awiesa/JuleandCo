const express = require("express");
const {
  getAttributes,
  getAttributeUsage,
  createAttribute,
  updateAttribute,
  deleteAttribute,
} = require("../controllers/attributeController");
const { protect, admin } = require("../middleware/authMiddleware");

const router = express.Router();

router.route("/").get(getAttributes).post(protect, admin, createAttribute);

// Above /:id, so "usage" is not parsed as an attribute id.
router.get("/usage", protect, admin, getAttributeUsage);

router.route("/:id").put(protect, admin, updateAttribute).delete(protect, admin, deleteAttribute);

module.exports = router;
