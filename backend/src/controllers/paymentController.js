const asyncHandler = require("express-async-handler");
const Order = require("../models/Order");
const {
  initialiseTransaction,
  verifyTransaction,
  signatureIsValid,
  toCedis,
} = require("../utils/paystack");
const { releaseStock } = require("../utils/orderPricing");

/**
 * Taking money, via Paystack.
 *
 * The order exists before the payment does. An abandoned checkout then leaves a
 * pending order the admin can see and cancel, rather than a customer charged
 * for something with no record — and the stock stays held while they pay, which
 * is the whole reason it is reserved at order time.
 *
 * **Nothing is marked paid because a browser said so.** The browser is
 * redirected back after payment and will happily claim success; only Paystack's
 * signed webhook, and a re-verification against Paystack's own record, are
 * treated as evidence.
 */

/**
 * Applies a verified Paystack transaction to its order.
 *
 * Shared by the webhook and the return-from-Paystack check, so both routes
 * reach the same conclusion the same way. Idempotent: Paystack retries webhooks,
 * and a customer can refresh the callback page, so this must be safe to run
 * repeatedly.
 */
async function applyTransaction(transaction) {
  const order = await Order.findOne({ orderNumber: transaction.reference });
  if (!order) return { ok: false, reason: "no order matches that reference" };

  if (order.paymentStatus === "paid") {
    return { ok: true, order, alreadyApplied: true };
  }

  if (transaction.status !== "success") {
    order.paymentStatus = "failed";
    await order.save();
    return { ok: false, order, reason: `payment ${transaction.status}` };
  }

  /**
   * The amount is checked against the order rather than trusted.
   *
   * Paystack reports what was actually charged; if it does not match what the
   * order says is owed, something is wrong — a tampered initialisation, a
   * changed price, a reused reference — and quietly marking it paid would mean
   * shipping goods for the wrong money.
   */
  const paid = toCedis(transaction.amount);
  if (paid !== order.totalPrice) {
    order.paymentStatus = "failed";
    await order.save();
    return {
      ok: false,
      order,
      reason: `paid ${paid} but the order is ${order.totalPrice}`,
    };
  }

  order.paymentStatus = "paid";
  order.paymentReference = transaction.reference;
  order.paidAt = new Date();
  // Card or mobile money, as Paystack actually processed it, rather than what
  // the customer picked at checkout before changing their mind on Paystack.
  if (transaction.channel === "card") order.paymentMethod = "card";
  if (transaction.channel === "mobile_money") order.paymentMethod = "mobile_money";

  await order.save();
  return { ok: true, order };
}

// @desc    Start paying for an order
// @route   POST /api/payments/initialise
// @access  Public — the order number and email must match, which is the check
const initialisePayment = asyncHandler(async (req, res) => {
  const { orderNumber, email } = req.body;

  const order = await Order.findOne({ orderNumber });
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  // A bare order number is guessable enough that it should not be the only key
  // to a payment page carrying someone's name and address.
  if (String(email || "").toLowerCase().trim() !== order.customer.email) {
    res.status(403);
    throw new Error("That email does not match the order");
  }

  if (order.paymentStatus === "paid") {
    res.status(400);
    throw new Error("This order has already been paid for");
  }

  if (order.status === "cancelled") {
    res.status(400);
    throw new Error("This order was cancelled and cannot be paid for");
  }

  const base = (process.env.CLIENT_URL || "http://localhost:3000").split(",")[0].trim();
  const transaction = await initialiseTransaction({
    order,
    callbackUrl: `${base.replace(/\/+$/, "")}/checkout/complete`,
  });

  res.json({
    authorizationUrl: transaction.authorization_url,
    reference: transaction.reference,
  });
});

// @desc    Paystack tells us what happened
// @route   POST /api/payments/webhook
// @access  Public, but signed — the signature is the authentication
const paystackWebhook = asyncHandler(async (req, res) => {
  /**
   * `req.rawBody` is captured by the body parser, because the signature is over
   * the exact bytes Paystack sent. Re-serialising the parsed object would
   * reorder keys and the signature would never match.
   */
  if (!signatureIsValid(req.rawBody, req.headers["x-paystack-signature"])) {
    // Anyone can POST here; only Paystack can sign. Refusing quietly is right —
    // this is not a user-facing error.
    res.status(401);
    throw new Error("Invalid signature");
  }

  const event = req.body;

  if (event?.event !== "charge.success") {
    return res.json({ received: true, ignored: event?.event });
  }

  /**
   * The order is updated *before* acknowledging.
   *
   * Paystack asks for a fast 200 and retries anything else, so the temptation
   * is to acknowledge first and write afterwards. But then a crash between the
   * two loses the payment silently — Paystack has been told it succeeded and
   * will never retry. Applying first is one read and one write, measured in
   * milliseconds, and means a failure leaves the retry intact.
   *
   * Safe to repeat, because applyTransaction is idempotent.
   */
  const result = await applyTransaction(event.data);

  console.log(
    result.ok
      ? `[paystack] ${event.data.reference} paid${result.alreadyApplied ? " (already applied)" : ""}`
      : `[paystack] ${event.data.reference} NOT applied — ${result.reason}`
  );

  res.json({ received: true, applied: result.ok });
});

// @desc    Check an order's payment after the customer is sent back
// @route   GET /api/payments/status/:orderNumber
// @access  Public
const paymentStatus = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ orderNumber: req.params.orderNumber });
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  /**
   * If the webhook has not arrived yet — it is a separate HTTP call and can lag
   * a second or two — ask Paystack directly rather than telling the customer
   * their payment failed. Still verified against Paystack, never assumed from
   * the redirect.
   */
  if (order.paymentStatus === "pending") {
    try {
      const transaction = await verifyTransaction(order.orderNumber);
      await applyTransaction(transaction);
      await order.populate([]);
    } catch {
      // Not initialised, or Paystack unreachable. The order stays pending,
      // which is the truth.
    }
  }

  const fresh = await Order.findOne({ orderNumber: req.params.orderNumber });

  res.json({
    orderNumber: fresh.orderNumber,
    paymentStatus: fresh.paymentStatus,
    totalPrice: fresh.totalPrice,
    status: fresh.status,
  });
});

// @desc    Abandon an unpaid order and give its stock back
// @route   POST /api/payments/abandon
// @access  Public — same email check as initialising
const abandonPayment = asyncHandler(async (req, res) => {
  const { orderNumber, email } = req.body;

  const order = await Order.findOne({ orderNumber });
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  if (String(email || "").toLowerCase().trim() !== order.customer.email) {
    res.status(403);
    throw new Error("That email does not match the order");
  }

  if (order.paymentStatus === "paid") {
    res.status(400);
    throw new Error("This order has been paid for and cannot be abandoned");
  }

  // Stock was held when the order was placed. Someone who walks away from the
  // payment page should not keep a piece off the shop indefinitely.
  if (!order.stockReleased) {
    await releaseStock(order.items);
    order.stockReleased = true;
  }
  order.status = "cancelled";
  order.paymentStatus = "failed";
  await order.save();

  res.json({ message: "Order abandoned and stock returned" });
});

module.exports = {
  applyTransaction,
  initialisePayment,
  paystackWebhook,
  paymentStatus,
  abandonPayment,
};
