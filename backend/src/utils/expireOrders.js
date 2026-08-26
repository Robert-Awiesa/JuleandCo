const Order = require("../models/Order");
const { releaseStock } = require("./orderPricing");

/**
 * Returns the stock held by checkouts nobody finished.
 *
 * An order reserves its stock the moment it is created, before payment, so that
 * two people cannot buy the last piece at once. Until now that reservation was
 * only ever released by somebody explicitly cancelling — the admin in the
 * dashboard, or the customer pressing back from Paystack.
 *
 * Nobody does that. The ordinary case is a shopper who closes the tab, and on a
 * catalogue where most pieces are one-of-a-kind, a handful of those quietly
 * empties the shop while the admin sees nothing wrong. It is a slow leak with
 * no upper bound.
 *
 * This is the same action `POST /payments/abandon` already performs, applied on
 * a timer rather than waiting for someone to press a button.
 */

const DEFAULT_MINUTES = 60;

/** How long an unpaid order may hold its stock. */
function expiryMinutes() {
  const configured = Number(process.env.ORDER_EXPIRY_MINUTES);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MINUTES;
}

/**
 * Cancels unpaid orders past the window and gives their stock back.
 *
 * Only ever touches orders that are **both** unpaid and still pending, and that
 * still hold their stock. A paid order, a confirmed one, or one already
 * released is left alone whatever its age.
 */
async function expireAbandonedOrders({ minutes = expiryMinutes() } = {}) {
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);

  const stale = await Order.find({
    status: "pending",
    paymentStatus: "pending",
    stockReleased: { $ne: true },
    createdAt: { $lt: cutoff },
  });

  const expired = [];

  for (const order of stale) {
    await releaseStock(order.items);
    order.stockReleased = true;
    order.status = "cancelled";
    order.paymentStatus = "failed";
    await order.save();
    expired.push(order.orderNumber);
  }

  return { expired, minutes };
}

const CHECK_EVERY_MS = 10 * 60 * 1000;

/**
 * Runs the sweep on a timer inside the API process.
 *
 * Same reasoning as the backup schedule: the API is already awake, so this
 * needs no second service and no new bill. Unlike the backup it is on by
 * default — held stock is wrong everywhere, including on a developer's machine,
 * and there is nothing destructive about giving it back.
 */
function scheduleOrderExpiry() {
  if (process.env.NODE_ENV === "test") return null;
  if (process.env.ORDER_EXPIRY_ENABLED === "false") {
    console.log("[orders] expiry sweep disabled");
    return null;
  }

  const sweep = async () => {
    try {
      const { expired, minutes } = await expireAbandonedOrders();
      if (expired.length) {
        console.log(
          `[orders] returned stock from ${expired.length} checkout(s) ` +
            `abandoned over ${minutes} minutes ago: ${expired.join(", ")}`
        );
      }
    } catch (err) {
      // Logged and swallowed: a failed sweep must never take the shop down,
      // and the next one is ten minutes away.
      console.error(`[orders] expiry sweep failed — ${err.message}`);
    }
  };

  sweep();
  const timer = setInterval(sweep, CHECK_EVERY_MS);
  timer.unref();

  console.log(`[orders] expiry sweep every 10 min, window ${expiryMinutes()} min`);
  return timer;
}

module.exports = { expireAbandonedOrders, scheduleOrderExpiry, expiryMinutes };
