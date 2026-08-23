const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");

/**
 * Applies ADMIN_EMAIL / ADMIN_PASSWORD from backend/.env to the admin account.
 *
 * Those variables are only read when the seed script *creates* the user, so
 * editing them later changes nothing — Mongo keeps the bcrypt hash of whatever
 * the password was at creation time, and the login just says "invalid
 * credentials" with no hint as to why.
 *
 * Re-running the full seed would normally fix this, but seedData.js still
 * writes the pre-pivot variant shape and would damage the catalogue. This
 * touches nothing but the admin user.
 *
 *   node src/scripts/setAdminPassword.js
 *
 * The password is never printed. Assignment goes through the model so the
 * pre-save hook hashes it; writing to the collection directly would store it
 * in clear text.
 */
async function setAdminPassword() {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must both be set in backend/.env");
  }
  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD must be at least 8 characters (the User schema enforces this)");
  }

  await connectDB();

  let user = await User.findOne({ email }).select("+password");
  let created = false;

  if (!user) {
    user = new User({ name: "Store Admin", email, password, role: "admin" });
    created = true;
  } else {
    if (await user.matchPassword(password)) {
      console.log(`Admin ${email} already matches ADMIN_PASSWORD — nothing to do.`);
      return;
    }
    user.password = password;
    // An account seeded before roles existed, or demoted by hand, is still the
    // one the admin dashboard expects to log in with.
    if (user.role !== "admin") user.role = "admin";
  }

  await user.save();

  // Prove it from a fresh read rather than trusting the in-memory document.
  const check = await User.findOne({ email }).select("+password");
  const ok = await check.matchPassword(password);

  console.log(`${created ? "Created" : "Updated"} admin ${email} (role: ${check.role}).`);
  console.log(ok ? "Verified: the new password authenticates." : "WARNING: verification failed.");
  if (!ok) process.exitCode = 1;
}

setAdminPassword()
  .catch((err) => {
    console.error("Failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
