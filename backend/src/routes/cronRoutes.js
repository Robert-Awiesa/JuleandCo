const express = require("express");
const asyncHandler = require("express-async-handler");
const { runBackup } = require("../utils/backup");
const { expireAbandonedOrders } = require("../utils/expireOrders");

/**
 * Scheduled work, triggered over HTTP.
 *
 * On a long-lived server both of these ran on a timer inside the process. A
 * serverless function is frozen the moment it responds, so a `setInterval`
 * there never fires again — which would mean **no backups at all** on a tier
 * that has none of its own, and stock from abandoned checkouts held forever.
 *
 * Vercel Cron calls a URL on a schedule instead, so the work moves behind these
 * two endpoints. The in-process schedules still run when the API is hosted as a
 * long-lived server, and are simply never started on Vercel.
 */

const router = express.Router();

/**
 * Only the scheduler may call these.
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET` on every cron invocation.
 * Without the check these are public URLs that trigger a database dump and
 * cancel orders, which is not something to leave open.
 *
 * **Refuses when unset rather than allowing.** An unset secret is a
 * misconfiguration, and the safe reading of a missing password is "no".
 */
function onlyScheduler(req, res, next) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    res.status(503);
    throw new Error("CRON_SECRET is not set, so scheduled work cannot be authenticated");
  }

  if (req.get("authorization") !== `Bearer ${secret}`) {
    res.status(401);
    throw new Error("Not authorised");
  }

  next();
}

router.use(onlyScheduler);

// @desc    Take the daily backup
// @route   GET /api/cron/backup
// @access  Scheduler only
router.get(
  "/backup",
  asyncHandler(async (req, res) => {
    const keep = Number(process.env.BACKUP_KEEP) || 14;
    const result = await runBackup({ keep });

    console.log(
      `[backup] stored ${result.publicId} (${(result.bytes / 1024).toFixed(1)} KB)` +
        (result.pruned.length ? `, pruned ${result.pruned.length}` : "")
    );

    res.json({
      ok: true,
      publicId: result.publicId,
      bytes: result.bytes,
      pruned: result.pruned.length,
    });
  })
);

// @desc    Return stock held by checkouts nobody finished
// @route   GET /api/cron/expire-orders
// @access  Scheduler only
router.get(
  "/expire-orders",
  asyncHandler(async (req, res) => {
    const { expired, minutes } = await expireAbandonedOrders();

    if (expired.length) {
      console.log(
        `[orders] returned stock from ${expired.length} checkout(s) ` +
          `abandoned over ${minutes} minutes ago: ${expired.join(", ")}`
      );
    }

    res.json({ ok: true, expired: expired.length, orderNumbers: expired, minutes });
  })
);

module.exports = router;
