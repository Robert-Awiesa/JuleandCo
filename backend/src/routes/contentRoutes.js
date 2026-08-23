const express = require("express");
const {
  getAllContent,
  getContent,
  getSlotDescriptors,
  updateContent,
  resetContent,
} = require("../controllers/contentController");
const { protect, admin } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", getAllContent);

// Above /:slot so "meta" is not read as a slot name.
router.get("/meta/slots", protect, admin, getSlotDescriptors);

router
  .route("/:slot")
  .get(getContent)
  .put(protect, admin, updateContent)
  .delete(protect, admin, resetContent);

module.exports = router;
