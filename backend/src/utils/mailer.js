const https = require("https");

/**
 * Sending email, via Resend's HTTP API.
 *
 * No SDK: it is one POST, and a dependency that wraps one POST is a dependency
 * that can break a deploy for nothing. Same reasoning as utils/paystack.js.
 *
 * **Deliberately inert unless configured.** With no RESEND_API_KEY nothing is
 * sent and every call reports why — so a developer machine and the test suite
 * never mail a real customer, and a missing key on Render is loud rather than
 * silent.
 */

const HOST = "api.resend.com";

function isConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

/**
 * Who the mail comes from.
 *
 * Resend will only send from a verified domain, with one exception:
 * `onboarding@resend.dev` works immediately and is how this is tested before a
 * domain exists. Falling back to it means email works on day one rather than
 * being blocked on DNS.
 */
function sender() {
  return process.env.MAIL_FROM || "JULES & CO <onboarding@resend.dev>";
}

function post(path, body) {
  const payload = JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: HOST,
        path,
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          let parsed;
          try {
            parsed = raw ? JSON.parse(raw) : {};
          } catch {
            return reject(new Error(`Resend returned something unreadable (${res.statusCode})`));
          }

          if (res.statusCode >= 400) {
            return reject(new Error(parsed.message || `Resend refused the send (${res.statusCode})`));
          }
          resolve(parsed);
        });
      }
    );

    req.on("error", (err) => reject(new Error(`Could not reach Resend: ${err.message}`)));
    req.write(payload);
    req.end();
  });
}

/**
 * Sends one email.
 *
 * Both an HTML and a plain-text body are always supplied. Some clients render
 * only text, spam filters treat HTML-only mail with suspicion, and an order
 * confirmation that arrives unreadable is worse than one that arrives plain.
 */
async function sendEmail({ to, subject, html, text }) {
  if (!isConfigured()) {
    return { sent: false, reason: "RESEND_API_KEY is not set" };
  }

  /**
   * Never post from the test suite.
   *
   * app.js loads backend/.env into every test process, so the moment a real
   * RESEND_API_KEY sits there the suite would mail its fixture addresses on
   * every run. Checked after the configuration check so an unconfigured
   * environment still reports the missing key rather than hiding behind this.
   */
  if (process.env.NODE_ENV === "test") {
    return { sent: false, reason: "email is suppressed while testing" };
  }

  if (!to) {
    return { sent: false, reason: "no recipient" };
  }

  const result = await post("/emails", {
    from: sender(),
    to: [to],
    subject,
    html,
    text,
  });

  return { sent: true, id: result.id };
}

module.exports = { sendEmail, isConfigured, sender };
