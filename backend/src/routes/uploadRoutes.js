const express = require("express");
const { signUpload, getRecentUploads } = require("../controllers/uploadController");
const { protect, admin } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/sign", protect, admin, signUpload);
router.get("/recent", protect, admin, getRecentUploads);

module.exports = router;
