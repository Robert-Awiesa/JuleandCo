const express = require("express");
const { signUpload } = require("../controllers/uploadController");
const { protect, admin } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/sign", protect, admin, signUpload);

module.exports = router;
