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
 *
 * **Nothing internal ever appears in one of these.** A customer's receipt is
 * not a place for database ids, image URLs or variant keys — see `optionText`.
 */

const money = (n) =>
  new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" })
    .format(Number(n) || 0)
    .replace("GHS", "GH₵");

const escape = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Contact details the customer can reply to, as set under Settings. */
async function storeContact() {
  const stored = await SiteContent.findOne({ slot: "store.contact" }).lean();
  return stored?.data ?? defaultsFor("store.contact");
}

/**
 * Reads an order line's chosen options, whatever shape they arrive in.
 *
 * `options` and `selections` are Mongoose `Map` paths. On a document read back
 * from the database they are real Maps, and `Object.values()` on one returns
 * the *document's own internals* — which is how a customer's receipt ended up
 * printing `{ product: new ObjectId(...), image: '...' } / options / [object
 * Object]` instead of "White Gold".
 *
 * A freshly created document still holds a plain object, which is why a test
 * that never re-read the order could not see the fault. Both shapes, and a
 * subdocument exposing `toObject`, are handled here.
 */
function entriesOf(value) {
  if (!value) return [];
  if (value instanceof Map) return Array.from(value.entries());
  if (typeof value.toObject === "function") return Object.entries(value.toObject());
  return Object.entries(value);
}

/**
 * "Metal: White Gold · Lens: Sage Tint".
 *
 * Labelled rather than a bare list of values, because "Sage · Sage Tint" does
 * not tell anyone which is the frame and which is the lens.
 */
function optionText(item) {
  return [...entriesOf(item.options), ...entriesOf(item.selections)]
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([label, value]) => `${label}: ${value}`)
    .join(" · ");
}

function itemLines(order) {
  return order.items.map((item) => ({
    name: item.name,
    detail: optionText(item),
    quantity: item.quantity,
    total: money(item.price * item.quantity),
  }));
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

/** "12 Oxford Street, Accra, Greater Accra" — the parts that exist, in order. */
function addressText(order) {
  const a = order.shippingAddress || {};
  return [a.address, a.city, a.region].filter(Boolean).join(", ");
}

const orderDate = (order) =>
  new Date(order.createdAt || Date.now()).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

/**
 * The shell every email shares.
 *
 * Tables rather than flexbox, and inline styles rather than a stylesheet:
 * Outlook ignores most modern CSS, and a receipt that collapses into an
 * unreadable column is worse than a plain one.
 */
function layout({ heading, intro, order, closing, contact, highlight }) {
  const lines = itemLines(order);

  const rows = lines
    .map(
      (line) => `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #eceae6;vertical-align:top;">
            <div style="font-size:15px;color:#1c1917;">
              ${escape(line.quantity)} &times; ${escape(line.name)}
            </div>
            ${
              line.detail
                ? `<div style="margin-top:4px;font-size:13px;color:#8a8479;">${escape(line.detail)}</div>`
                : ""
            }
          </td>
          <td style="padding:14px 0;border-bottom:1px solid #eceae6;text-align:right;white-space:nowrap;vertical-align:top;font-size:15px;color:#1c1917;">
            ${escape(line.total)}
          </td>
        </tr>`
    )
    .join("");

  const contactBits = [
    contact.email ? `<a href="mailto:${escape(contact.email)}" style="color:#a08a45;text-decoration:none;">${escape(contact.email)}</a>` : "",
    contact.phone ? escape(contact.phone) : "",
    contact.whatsapp ? `WhatsApp ${escape(contact.whatsapp)}` : "",
  ].filter(Boolean);

  const address = addressText(order);

  const html = `
<div style="margin:0;padding:32px 12px;background:#f6f4f1;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#1c1917;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;">
    <tr>
      <td style="padding:32px 36px 0;text-align:center;">
        <div style="font-size:13px;letter-spacing:4px;color:#a08a45;text-transform:uppercase;">Jules &amp; Co</div>
      </td>
    </tr>

    <tr>
      <td style="padding:28px 36px 0;">
        <h1 style="margin:0 0 10px;font-size:23px;font-weight:600;line-height:1.3;">${escape(heading)}</h1>
        <p style="margin:0;font-size:15px;line-height:1.65;color:#44403c;">${intro}</p>
      </td>
    </tr>

    ${
      highlight
        ? `<tr>
      <td style="padding:22px 36px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#faf8f5;border-left:3px solid #a08a45;">
          <tr><td style="padding:14px 18px;font-size:14px;color:#44403c;">${highlight}</td></tr>
        </table>
      </td>
    </tr>`
        : ""
    }

    <tr>
      <td style="padding:28px 36px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#8a8479;">Order</td>
            <td style="text-align:right;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#8a8479;">Placed</td>
          </tr>
          <tr>
            <td style="padding-top:3px;font-size:15px;font-weight:600;">${escape(order.orderNumber)}</td>
            <td style="padding-top:3px;text-align:right;font-size:15px;">${escape(orderDate(order))}</td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td style="padding:18px 36px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td colspan="2" style="padding-bottom:6px;border-bottom:1px solid #1c1917;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#8a8479;">
              Your order
            </td>
          </tr>
          ${rows}
        </table>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:14px;">
          <tr>
            <td style="padding:4px 0;font-size:14px;color:#44403c;">Items</td>
            <td style="padding:4px 0;text-align:right;font-size:14px;color:#44403c;">${escape(money(order.itemsPrice))}</td>
          </tr>
          <tr>
            <td style="padding:8px 0 0;border-top:1px solid #eceae6;font-size:16px;font-weight:600;">Total</td>
            <td style="padding:8px 0 0;border-top:1px solid #eceae6;text-align:right;font-size:16px;font-weight:600;">${escape(money(order.totalPrice))}</td>
          </tr>
        </table>

        <p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#8a8479;">${escape(deliveryLine(order))}</p>
      </td>
    </tr>

    ${
      address
        ? `<tr>
      <td style="padding:26px 36px 0;">
        <div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#8a8479;">Delivering to</div>
        <div style="margin-top:5px;font-size:14px;line-height:1.6;color:#44403c;">
          ${escape(order.shippingAddress?.fullName || "")}<br />${escape(address)}
        </div>
      </td>
    </tr>`
        : ""
    }

    <tr>
      <td style="padding:26px 36px 0;">
        <p style="margin:0;font-size:15px;line-height:1.65;color:#44403c;">${closing}</p>
      </td>
    </tr>

    <tr>
      <td style="padding:28px 36px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid #eceae6;">
          <tr>
            <td style="padding-top:16px;text-align:center;font-size:13px;line-height:1.7;color:#8a8479;">
              ${contactBits.length ? `${contactBits.join(" &nbsp;·&nbsp; ")}<br />` : ""}
              <span style="display:inline-block;margin-top:10px;font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:#a08a45;">
                Wear the Difference
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>`;

  const strip = (s) => String(s).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

  const text = [
    "JULES & CO",
    "",
    heading.toUpperCase(),
    "",
    strip(intro),
    ...(highlight ? ["", strip(highlight)] : []),
    "",
    `Order ${order.orderNumber}   Placed ${orderDate(order)}`,
    "",
    "YOUR ORDER",
    ...lines.map(
      (l) => `  ${l.quantity} x ${l.name}${l.detail ? `\n      ${l.detail}` : ""}\n      ${l.total}`
    ),
    "",
    `Items:  ${money(order.itemsPrice)}`,
    `Total:  ${money(order.totalPrice)}`,
    deliveryLine(order),
    ...(address
      ? ["", "DELIVERING TO", `  ${order.shippingAddress?.fullName || ""}`, `  ${address}`]
      : []),
    "",
    strip(closing),
    "",
    ...(contactBits.length ? [strip(contactBits.join(" · ")), ""] : []),
    "Wear the Difference",
  ].join("\n");

  return { html, text };
}

/** One entry per moment. Adding a sixth is adding one object here. */
const EMAILS = {
  paid: (order) => ({
    subject: `Your JULES & CO order ${order.orderNumber}`,
    heading: "Thank you — we have your order",
    intro: "Your payment has gone through and your order is with us.",
    highlight:
      "We will confirm your order shortly and agree the delivery cost with you before anything is dispatched.",
    closing:
      "Keep this email — the order number above is what we will refer to if you get in touch.",
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
    intro: "It has left us and is on its way to you.",
    highlight: order.trackingNumber
      ? `Tracking reference: <strong>${escape(order.trackingNumber)}</strong>`
      : "",
    closing:
      "If anything is not right when it arrives, reply to this email and we will put it right.",
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
    highlight:
      order.paymentStatus === "paid"
        ? "You paid for this order, so a refund is due to you. We will be in touch about it."
        : "Nothing has been charged.",
    closing: "Reply to this email if this was not what you expected.",
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
  const { subject, heading, intro, closing, highlight } = template(order);
  const { html, text } = layout({ heading, intro, order, closing, contact, highlight });

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

module.exports = { EMAILS, sendOrderEmail, notifyCustomer, deliveryLine, optionText };
