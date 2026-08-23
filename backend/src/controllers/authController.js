const asyncHandler = require("express-async-handler");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");

const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function setAuthCookie(res, token) {
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_MS,
  });
}

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;

  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error("An account with that email already exists");
  }

  const user = await User.create({ name, email, password, phone });
  const token = generateToken(user._id, user.role);
  setAuthCookie(res, token);

  res.status(201).json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    token,
  });
});

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.matchPassword(password))) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  const token = generateToken(user._id, user.role);
  setAuthCookie(res, token);

  res.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    token,
  });
});

// @desc    Log out — clears the auth cookie
// @route   POST /api/auth/logout
// @access  Public
const logoutUser = asyncHandler(async (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out" });
});

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
  res.json(req.user);
});


/**
 * Administrator accounts.
 *
 * There was exactly one administrator, created by the seed, and the only way to
 * change its password was a command-line script on the server. That is fine for
 * one person setting a shop up and wrong the moment anyone else needs access —
 * or the moment someone leaves.
 *
 * Two guards matter more than anything else here: the last administrator cannot
 * be removed, and nobody can remove themselves. Either would lock the shop out
 * of its own dashboard, and there is no recovery from the interface.
 */

// @desc    List administrators
// @route   GET /api/auth/admins
// @access  Private/Admin
const getAdmins = asyncHandler(async (req, res) => {
  const admins = await User.find({ role: "admin" }, "name email createdAt").sort({ createdAt: 1 });
  res.json(admins);
});

// @desc    Add an administrator
// @route   POST /api/auth/admins
// @access  Private/Admin
const createAdmin = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error("A name, email address and password are all required");
  }

  if (String(password).length < 8) {
    res.status(400);
    throw new Error("The password needs to be at least 8 characters");
  }

  const existing = await User.findOne({ email: String(email).toLowerCase() });
  if (existing) {
    // Promote rather than refuse: an existing customer account with this
    // address is the same person, and a second account would split their history.
    if (existing.role === "admin") {
      res.status(400);
      throw new Error(`${existing.email} is already an administrator`);
    }
    existing.role = "admin";
    await existing.save();
    return res.status(200).json({ _id: existing._id, name: existing.name, email: existing.email });
  }

  const admin = await User.create({ name, email, password, role: "admin" });
  res.status(201).json({ _id: admin._id, name: admin.name, email: admin.email });
});

// @desc    Remove an administrator
// @route   DELETE /api/auth/admins/:id
// @access  Private/Admin
const removeAdmin = asyncHandler(async (req, res) => {
  const target = await User.findById(req.params.id);

  if (!target || target.role !== "admin") {
    res.status(404);
    throw new Error("Administrator not found");
  }

  if (String(target._id) === String(req.user._id)) {
    res.status(400);
    throw new Error("You cannot remove your own access — ask another administrator to do it");
  }

  const admins = await User.countDocuments({ role: "admin" });
  if (admins <= 1) {
    res.status(400);
    throw new Error("This is the only administrator. Add another before removing this one.");
  }

  // The account is kept and demoted rather than deleted: it may have orders
  // against it, and deleting a user who placed one would orphan the record.
  target.role = "customer";
  await target.save();

  res.json({ message: `${target.email} no longer has admin access` });
});

// @desc    Change your own password
// @route   PUT /api/auth/password
// @access  Private
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!newPassword || String(newPassword).length < 8) {
    res.status(400);
    throw new Error("The new password needs to be at least 8 characters");
  }

  const user = await User.findById(req.user._id).select("+password");

  // Asked for even though the session proves identity: it is what stops an
  // unattended logged-in screen becoming a permanent takeover.
  if (!(await user.matchPassword(String(currentPassword || "")))) {
    res.status(401);
    throw new Error("That is not your current password");
  }

  user.password = newPassword;
  await user.save();

  res.json({ message: "Password changed" });
});

module.exports = { registerUser, loginUser, logoutUser, getMe, getAdmins, createAdmin, removeAdmin, changePassword };
