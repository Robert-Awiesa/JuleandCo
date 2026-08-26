/**
 * The Express API, as a Vercel Serverless Function.
 *
 * Vercel runs Next natively and has no long-lived process to host a server, so
 * `backend/server.js` — which listens on a port and serves Next itself — is not
 * used there. This module is the entry point instead: Vercel turns every file
 * under `/api` into a function, and `vercel.json` rewrites `/api/*` onto this
 * one, so the whole Express app is reachable at exactly the paths it already
 * declares.
 *
 * **Same origin is the point.** The storefront and the API are served from one
 * deployment, so the admin auth cookie set by `/api/auth/login` is sent back on
 * every `/admin` request and `frontend/middleware.ts` can verify it. Splitting
 * them across two hosts is what used to make admin login silently bounce.
 *
 * Local development is unchanged: `npm run dev` still runs `backend/server.js`.
 */
/**
 * Vercel must not parse the request body.
 *
 * Its Node runtime helpfully populates `req.body` for JSON requests — which
 * consumes the stream before Express sees it. Two things then break: Express's
 * own parser produces an empty object, and `req.rawBody` is never captured.
 *
 * That second one matters most. Paystack signs the **exact bytes** it sent, so
 * the webhook signature is checked against the raw body. Without it every
 * webhook would be refused as forged, and orders customers had genuinely paid
 * for would sit unpaid forever — a failure that looks like Paystack's fault.
 */
module.exports.config = {
  api: { bodyParser: false },
};

const app = require("../backend/src/app");
const connectDB = require("../backend/src/config/db");

module.exports = async (req, res) => {
  try {
    /**
     * Connected per invocation rather than once at boot, because there is no
     * boot. connectDB caches the connection on globalThis, so a warm instance
     * reuses it and only a genuine cold start pays for a handshake.
     */
    await connectDB();
  } catch (err) {
    // Without this the request would hang until the platform timed it out,
    // which reads as a dead site rather than a database problem.
    console.error(`[api] database unavailable — ${err.message}`);
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ message: "The store is temporarily unavailable" }));
  }

  return app(req, res);
};
