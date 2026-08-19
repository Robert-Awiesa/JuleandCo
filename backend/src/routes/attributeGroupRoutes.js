const express = require("express");
const {
  getAttributeGroups,
  createAttributeGroup,
  updateAttributeGroup,
  deleteAttributeGroup,
} = require("../controllers/attributeGroupController");
const { protect, admin } = require("../middleware/authMiddleware");

const router = express.Router();

router.route("/").get(getAttributeGroups).post(protect, admin, createAttributeGroup);
router
  .route("/:id")
  .put(protect, admin, updateAttributeGroup)
  .delete(protect, admin, deleteAttributeGroup);

module.exports = router;
