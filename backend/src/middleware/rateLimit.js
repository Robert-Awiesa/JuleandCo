const rateLimit = require("express-rate-limit");

/**
 * Limits on what a single caller can do.
 *
 * The shop is public and unauthenticated: anyone can place an order, submit a
 * review, or try an admin password. None of those had a ceiling, which is fine
 * while nobody knows the address and a problem the day one does.
 *
 * **Applied in production only.** These protect a public address. A developer
 * machine and an end-to-end run are not public, and both make far more calls
 * from one address than any person would — the Playwright suite alone signs in
 * a couple of dozen times in a few minutes, which is indistinguishable from a
 * brute-force attempt and would turn a working limiter into a test failure that
 * looks like a broken login.
 *
 * RATE_LIMIT_FORCE=true switches them on anywhere, which is how the limits get
 * verified without deploying.
 */
const enforced =
  process.env.NODE_ENV === "production" || process.env.RATE_LIMIT_FORCE === "true";

function limiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    // Skipped entirely rather than given a huge ceiling, so development and the
    // suites exercise the real handler rather than a differently-configured one.
    skip: () => !enforced,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message },
  });
}

/**
 * Everything under /api.
 *
 * Generous — a shopper browsing quickly with a catalogue page, facets and
 * images is a burst of requests, and throttling a real customer to protect
 * against a hypothetical one is the wrong trade.
 */
const general = limiter({
  windowMs: 15 * 60 * 1000,
  max: 600,
  message: "Too many requests. Please wait a moment and try again.",
});

/**
 * Signing in.
 *
 * There is one administrator and one password, and nothing else stands between
 * a guessed password and the whole shop. Ten attempts a quarter-hour is more
 * than a person who has forgotten theirs needs, and useless for guessing.
 */
const login = limiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many sign-in attempts. Please wait fifteen minutes and try again.",
});

/**
 * Placing an order, and starting a payment.
 *
 * Placing an order *reserves stock*, so an unlimited endpoint is a way to empty
 * the catalogue without paying for anything.
 */
const checkout = limiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many orders from this connection. Please wait a moment and try again.",
});

/**
 * Writing a review.
 *
 * Reviews arrive unapproved so nothing reaches a product page unmoderated, but
 * an unlimited box still lets someone bury the queue in thousands of rows.
 */
const review = limiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: "Too many reviews from this connection. Please try again later.",
});

module.exports = { general, login, checkout, review };
