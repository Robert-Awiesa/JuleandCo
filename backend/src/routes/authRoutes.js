const express = require("express");
const {
  registerUser,
  loginUser,
  logoutUser,
  getMe,
  getAdmins,
  createAdmin,
  removeAdmin,
  changePassword,
} = require("../controllers/authController");
const { protect, admin } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/logout", logoutUser);
router.get("/me", protect, getMe);
router.put("/password", protect, changePassword);

router.route("/admins").get(protect, admin, getAdmins).post(protect, admin, createAdmin);
router.delete("/admins/:id", protect, admin, removeAdmin);

module.exports = router;
