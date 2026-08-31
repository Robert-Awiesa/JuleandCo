const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const limits = require("./middleware/rateLimit");

const productRoutes = require("./routes/productRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const orderRoutes = require("./routes/orderRoutes");
const authRoutes = require("./routes/authRoutes");
const subcategoryRoutes = require("./routes/subcategoryRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const attributeRoutes = require("./routes/attributeRoutes");
const attributeGroupRoutes = require("./routes/attributeGroupRoutes");
const contentRoutes = require("./routes/contentRoutes");
const customerRoutes = require("./routes/customerRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const cronRoutes = require("./routes/cronRoutes");
const subscriberRoutes = require("./routes/subscriberRoutes");

const app = express();

// Render terminates TLS at its edge and forwards over HTTP. Without this Express
// sees an insecure request and refuses to set `secure` cookies, so login would
// silently never persist in production.
app.set("trust proxy", 1);

/**
 * Security headers.
 *
 * Content-Security-Policy is off: Next emits its own inline bootstrap and
 * styles, and a CSP written here would either break the storefront or be so
 * permissive it protected nothing. Cross-Origin-Embedder-Policy is off too —
 * it blocks Cloudinary product photography, which is the whole catalogue.
 * The rest (HSTS, nosniff, frame denial, referrer policy) all apply.
 */
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

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
/**
 * `verify` keeps the raw bytes alongside the parsed body.
 *
 * Paystack signs the exact payload it sent, and re-serialising the parsed
 * object would reorder keys and break the signature — so the webhook could
 * never be authenticated.
 */
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(cookieParser());
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

/**
 * Rate limits, applied before the routes.
 *
 * Paystack's webhook is deliberately exempt: they retry on anything that is not
 * a 2xx, so throttling it would turn a burst into a payment that never gets
 * recorded. It authenticates by signature, so it is not an open endpoint.
 */
app.use("/api", (req, res, next) =>
  req.path === "/payments/webhook" ? next() : limits.general(req, res, next)
);
app.use("/api/auth/login", limits.login);
app.use("/api/orders", (req, res, next) =>
  req.method === "POST" ? limits.checkout(req, res, next) : next()
);
app.use("/api/payments/initialise", limits.checkout);

app.use("/api/cron", cronRoutes);
app.use("/api/subscribers", subscriberRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/subcategories", subcategoryRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/attributes", attributeRoutes);
app.use("/api/attribute-groups", attributeGroupRoutes);
app.use("/api/content", contentRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/payments", paymentRoutes);

/**
 * Where the storefront is served from, when both run as one Render service.
 *
 * The two were separate services because the auth cookie has to be same-origin:
 * the API sets it and frontend/middleware.ts reads it back to guard /admin, and
 * across two hosts the browser would never send it. Serving both from one
 * process makes that true by construction rather than by proxy — and the
 * failure isolation given up is mostly illusory here, because every storefront
 * page render calls the API anyway. If the API is down the shop is broken
 * either way.
 *
 * Registered here, before the 404 handler, so ordering is correct at load time
 * even though the handler itself is attached later by server.js once Next has
 * finished preparing.
 */
let serveFrontend = null;

app.use((req, res, next) => {
  if (serveFrontend && !req.path.startsWith("/api")) {
    return serveFrontend(req, res);
  }
  next();
});

/**
 * Scoped to /api so it cannot swallow a storefront route. Running API-only,
 * this leaves non-API paths to Express's own 404, which is more honest than a
 * JSON "route not found" for a path the API was never meant to own.
 */
app.use("/api", notFound);
app.use(errorHandler);

/** Called by server.js when SERVE_FRONTEND is on. */
app.setFrontendHandler = (handler) => {
  serveFrontend = handler;
};

module.exports = app;
