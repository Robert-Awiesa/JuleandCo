const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const productRoutes = require("./routes/productRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const orderRoutes = require("./routes/orderRoutes");
const authRoutes = require("./routes/authRoutes");
const subcategoryRoutes = require("./routes/subcategoryRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const attributeRoutes = require("./routes/attributeRoutes");
const attributeGroupRoutes = require("./routes/attributeGroupRoutes");

const app = express();

// Render terminates TLS at its edge and forwards over HTTP. Without this Express
// sees an insecure request and refuses to set `secure` cookies, so login would
// silently never persist in production.
app.set("trust proxy", 1);

/**
 * CORS.
 *
 * CLIENT_URL accepts a comma-separated list, and outside production any
 * localhost port is allowed. Previously this was a single hardcoded origin, so
 * when Next fell back to port 3001 (because 3000 was busy) every admin request
 * failed with an opaque preflight error that looks nothing like the real cause.
 *
 * Credentials are on, so the matched origin must be echoed back — a wildcard is
 * not permitted by the browser here.
 */
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:3000")
  .split(",")
  .map((entry) => entry.trim().replace(/\/+$/, ""))
  .filter(Boolean)
  // Render's `fromService … property: host` yields a bare hostname, but an
  // Origin header always carries a scheme, so a bare value would never match.
  .map((entry) => (/^https?:\/\//.test(entry) ? entry : `https://${entry}`));

const isDevLocalhost = (origin) =>
  process.env.NODE_ENV !== "production" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

app.use(
  cors({
    origin(origin, callback) {
      // Same-origin, curl and server-side requests send no Origin header.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || isDevLocalhost(origin)) return callback(null, true);

      console.warn(
        `[cors] blocked origin ${origin} — add it to CLIENT_URL in backend/.env (currently: ${allowedOrigins.join(", ")})`
      );
      // Reject by withholding the header rather than throwing: the browser
      // blocks the request either way, and throwing turns every stray bot
      // request into a logged 500.
      return callback(null, false);
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/subcategories", subcategoryRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/attributes", attributeRoutes);
app.use("/api/attribute-groups", attributeGroupRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
