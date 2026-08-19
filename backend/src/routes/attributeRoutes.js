const express = require("express");
const {
  getAttributes,
  createAttribute,
  updateAttribute,
  deleteAttribute,
} = require("../controllers/attributeController");
const { protect, admin } = require("../middleware/authMiddleware");

const router = express.Router();

router.route("/").get(getAttributes).post(protect, admin, createAttribute);
router.route("/:id").put(protect, admin, updateAttribute).delete(protect, admin, deleteAttribute);

module.exports = router;
