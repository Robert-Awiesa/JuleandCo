const https = require("https");
const crypto = require("crypto");

/**
 * Paystack, talked to over plain HTTPS rather than their SDK.
 *
 * Three calls are needed — initialise, verify, and validating a webhook
 * signature — and the SDK would be a dependency carrying far more than that.
 *
 * **The secret key never leaves this process.** Only the public key reaches a
 * browser, which is what it is for.
 */

const HOST = "api.paystack.co";

/** GHS 90 is 9000 pesewas. Paystack works in the smallest unit, always. */
function toPesewas(amountInCedis) {
  return Math.round(Number(amountInCedis) * 100);
}

/** And back again, for comparing what Paystack reports against an order. */
function toCedis(pesewas) {
  return Math.round(Number(pesewas)) / 100;
}

function secretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    const error = new Error(
      "PAYSTACK_SECRET_KEY is not set — payments cannot be taken until it is"
    );
    error.statusCode = 500;
    throw error;
  }
  return key;
}

function request(method, path, body) {
  const payload = body ? JSON.stringify(body) : null;

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: HOST,
        path,
        method,
        headers: {
          Authorization: `Bearer ${secretKey()}`,
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch {
            return reject(new Error(`Paystack returned something unreadable (${res.statusCode})`));
          }

          if (!parsed.status) {
            // Paystack puts the reason in `message`; passing it on beats a
            // generic "payment failed" that nobody can act on.
            return reject(new Error(parsed.message || `Paystack refused the request`));
          }
          resolve(parsed.data);
        });
      }
    );

    req.on("error", (err) =>
      reject(new Error(`Could not reach Paystack: ${err.message}`))
    );

    if (payload) req.write(payload);
    req.end();
  });
}

/**
 * Starts a transaction and returns the URL to send the customer to.
 *
 * The order number goes in as the reference so a Paystack transaction can
 * always be traced back to an order, and the metadata carries it again for the
 * dashboard — which matters doubly if this account also settles another
 * business.
 */
async function initialiseTransaction({ order, callbackUrl }) {
  return request("POST", "/transaction/initialize", {
    email: order.customer.email,
    amount: toPesewas(order.totalPrice),
    currency: "GHS",
    reference: order.orderNumber,
    callback_url: callbackUrl,
    metadata: {
      orderNumber: order.orderNumber,
      orderId: String(order._id),
      customerName: order.customer.name,
      custom_fields: [
        { display_name: "Order", variable_name: "order", value: order.orderNumber },
      ],
    },
  });
}

/** Asks Paystack what actually happened. Never trust the browser for this. */
async function verifyTransaction(reference) {
  return request("GET", `/transaction/verify/${encodeURIComponent(reference)}`);
}

/**
 * Confirms a webhook really came from Paystack.
 *
 * The body is signed with the secret key, so anyone can POST to the endpoint
 * but only Paystack can sign correctly. Without this check the webhook is an
 * open invitation to mark any order paid.
 *
 * Compared with timingSafeEqual rather than === so the comparison cannot be
 * attacked a character at a time.
 */
function signatureIsValid(rawBody, signature) {
  if (!signature) return false;

  const expected = crypto
    .createHmac("sha512", secretKey())
    .update(rawBody)
    .digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(String(signature), "utf8");

  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = {
  toPesewas,
  toCedis,
  initialiseTransaction,
  verifyTransaction,
  signatureIsValid,
};
