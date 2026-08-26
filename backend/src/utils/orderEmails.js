const SiteContent = require("../models/SiteContent");
const { defaultsFor } = require("./contentSlots");
// Required as a module rather than destructured, so a test can intercept the
// send. A destructured reference is captured at import and cannot be replaced —
// a test that believed it had stubbed the mailer would post real email.
const mailer = require("./mailer");

/**
 * What a customer is told, and when.
 *
 * Five moments, each the answer to a question the customer would otherwise have
 * to ask:
 *
 *   paid      — did my money arrive, and what did I buy?
 *   confirmed — has a person actually seen this?
 *   shipped   — where is it?
 *   delivered — that's it, and here is how to reach us.
 *   cancelled — what happened to my money?
 *
 * Cancellation is included even though it was not asked for. Cancelling an
 * order the customer paid for and saying nothing is the worst thing this shop
 * could do by email, and it is when a refund conversation starts.
 *
 * **Sending never blocks an order.** A payment must not fail because a mail
 * provider is slow, so every send is caught and logged rather than thrown.
 */

const money = (n) =>
  new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" })
    .format(Number(n) || 0)
    .replace("GHS", "GH₵");

/** Contact details the customer can reply to, as set under Settings. */
async function storeContact() {
  const stored = await SiteContent.findOne({ slot: "store.contact" }).lean();
  return stored?.data ?? defaultsFor("store.contact");
}

function itemLines(order) {
  return order.items.map((item) => {
    const chosen = [
      ...Object.values(item.options || {}),
      ...Object.values(item.selections || {}),
    ].filter(Boolean);

    return {
      name: item.name,
      detail: chosen.length ? chosen.join(" / ") : "",
      quantity: item.quantity,
      total: money(item.price * item.quantity),
    };
  });
}

/**
 * Delivery, said the way the shop actually works: it is agreed after the order
 * is confirmed, so an email must not imply a figure that does not exist yet.
 */
function deliveryLine(order) {
  if (order.shippingPrice === null || order.shippingPrice === undefined) {
    return "Delivery will be arranged with you — we will confirm the cost before dispatch.";
  }
  if (order.shippingPrice === 0) return "Delivery: no charge.";
  return `Delivery: ${money(order.shippingPrice)}.`;
}

function layout({ heading, intro, order, closing, contact }) {
  const rows = itemLines(order)
    .map(
      (line) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #eceae6;">
            ${line.quantity} × ${line.name}
            ${line.detail ? `<div style="color:#8a8479;font-size:13px;">${line.detail}</div>` : ""}
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #eceae6;text-align:right;white-space:nowrap;">
            ${line.total}
          </td>
        </tr>`
    )
    .join("");

  const reply = [
    contact.email ? `Email: ${contact.email}` : "",
    contact.phone ? `Phone: ${contact.phone}` : "",
    contact.whatsapp ? `WhatsApp: ${contact.whatsapp}` : "",
  ]
    .filter(Boolean)
    .join(" &nbsp;·&nbsp; ");

  const html = `
  <div style="background:#f6f4f1;padding:28px 12px;font-family:Helvetica,Arial,sans-serif;color:#1c1917;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;padding:32px;">
      <p style="margin:0 0 24px;letter-spacing:3px;font-size:12px;color:#a08a45;text-transform:uppercase;">
        Jules &amp; Co
      </p>

      <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;">${heading}</h1>
      <p style="margin:0 0 24px;line-height:1.6;color:#44403c;">${intro}</p>

      <p style="margin:0 0 8px;font-size:13px;color:#8a8479;">Order ${order.orderNumber}</p>

      <table style="width:100%;border-collapse:collapse;font-size:14px;">${rows}</table>

      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:12px;">
        <tr>
          <td style="padding:6px 0;color:#44403c;">Items</td>
          <td style="padding:6px 0;text-align:right;">${money(order.itemsPrice)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-weight:600;">Total</td>
          <td style="padding:6px 0;text-align:right;font-weight:600;">${money(order.totalPrice)}</td>
        </tr>
      </table>

      <p style="margin:16px 0 0;font-size:13px;color:#8a8479;line-height:1.6;">${deliveryLine(order)}</p>

      <p style="margin:24px 0 0;line-height:1.6;color:#44403c;">${closing}</p>

      ${reply ? `<p style="margin:24px 0 0;font-size:13px;color:#8a8479;">${reply}</p>` : ""}

      <p style="margin:28px 0 0;padding-top:16px;border-top:1px solid #eceae6;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#a08a45;">
        Wear the Difference
      </p>
    </div>
  </div>`;

  const text = [
    "JULES & CO",
    "",
    heading,
    "",
    intro.replace(/<[^>]+>/g, ""),
    "",
    `Order ${order.orderNumber}`,
    ...itemLines(order).map(
      (l) => `  ${l.quantity} x ${l.name}${l.detail ? ` (${l.detail})` : ""} — ${l.total}`
    ),
    "",
    `Items: ${money(order.itemsPrice)}`,
    `Total: ${money(order.totalPrice)}`,
    deliveryLine(order),
    "",
    closing.replace(/<[^>]+>/g, ""),
    "",
    reply.replace(/&nbsp;·&nbsp;/g, " · "),
  ].join("\n");

  return { html, text };
}

/** One entry per moment. Adding a sixth is adding one object here. */
const EMAILS = {
  paid: (order) => ({
    subject: `Your JULES & CO order ${order.orderNumber}`,
    heading: "Thank you — we have your order",
    intro:
      "Your payment went through and your order is with us. Here is what you bought.",
    closing:
      "We will be in touch shortly to confirm it and arrange delivery. Keep this email — the order number above is what we will refer to.",
  }),

  processing: (order) => ({
    subject: `Order ${order.orderNumber} confirmed`,
    heading: "Your order is confirmed",
    intro: "We have checked your order and are preparing it now.",
    closing:
      "We will let you know the moment it is on its way, and we will confirm the delivery cost with you before it leaves us.",
  }),

  shipped: (order) => ({
    subject: `Order ${order.orderNumber} is on its way`,
    heading: "Your order is on its way",
    intro: order.trackingNumber
      ? `It has left us. Your tracking reference is <strong>${order.trackingNumber}</strong>.`
      : "It has left us and is on its way to you.",
    closing: "If anything looks wrong when it arrives, reply to this email and we will put it right.",
  }),

  delivered: (order) => ({
    subject: `Order ${order.orderNumber} delivered`,
    heading: "Delivered",
    intro: "Your order has been marked as delivered. We hope you love it.",
    closing:
      "If it is not quite right, tell us — we would far rather hear from you than not. And if you have a moment, a review on the product page helps other customers enormously.",
  }),

  cancelled: (order) => ({
    subject: `Order ${order.orderNumber} cancelled`,
    heading: "Your order has been cancelled",
    intro: "This order has been cancelled and will not be dispatched.",
    closing:
      order.paymentStatus === "paid"
        ? "You paid for this order, so a refund is due to you. We will be in touch about it — reply to this email if you have not heard from us."
        : "Nothing has been charged. Reply to this email if this was not what you expected.",
  }),
};

/**
 * Sends the email for one moment in an order's life, once.
 *
 * Recorded on the order so a double-click, a corrected status, or a webhook
 * retry cannot mail the customer the same thing twice — which reads as a shop
 * that does not know what it is doing.
 */
async function sendOrderEmail(order, event) {
  const template = EMAILS[event];
  if (!template) return { sent: false, reason: `no email defined for "${event}"` };

  const already = (order.notifications || []).some((n) => n.event === event);
  if (already) return { sent: false, reason: "already sent" };

  const contact = await storeContact();
  const { subject, heading, intro, closing } = template(order);
  const { html, text } = layout({ heading, intro, order, closing, contact });

  const result = await mailer.sendEmail({ to: order.customer?.email, subject, html, text });

  if (result.sent) {
    order.notifications = [...(order.notifications || []), { event, sentAt: new Date() }];
    await order.save();
  }

  return result;
}

/**
 * The same, but never throws.
 *
 * Used on the payment and status paths, where a mail provider having a bad
 * minute must not fail a payment or block an admin from marking an order
 * shipped. Failures are logged loudly — silence would mean nobody learns that
 * customers stopped being told anything.
 */
async function notifyCustomer(order, event) {
  try {
    const result = await sendOrderEmail(order, event);
    if (result.sent) {
      console.log(`[email] ${event} → ${order.customer.email} for ${order.orderNumber}`);
    } else if (result.reason !== "already sent" && process.env.NODE_ENV !== "test") {
      // Not in tests: email is deliberately unconfigured there, and 25 copies
      // of the same warning per run is how a real one gets missed.
      console.warn(`[email] ${event} for ${order.orderNumber} not sent — ${result.reason}`);
    }
    return result;
  } catch (err) {
    console.error(`[email] ${event} for ${order.orderNumber} FAILED — ${err.message}`);
    return { sent: false, reason: err.message };
  }
}

module.exports = { EMAILS, sendOrderEmail, notifyCustomer, deliveryLine };
