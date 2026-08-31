const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const SiteContent = require("../models/SiteContent");

/**
 * Points the footer at pages that exist.
 *
 * The footer shipped with a Support column advertising /contact, /shipping,
 * /size-guide and /account/orders, and a Careers link — none of which were ever
 * built. Every one returned a 404, from the footer of every page on the site,
 * including the two a worried customer is most likely to click.
 *
 * Fixing the defaults is not enough: `layout.footer` is the one slot that has
 * been edited in the admin, so the saved document is what renders. This repairs
 * that document without touching anything else in it.
 *
 * Idempotent — a second run reports no changes.
 *
 *   npm run fix:footer-links -w backend
 */

/** Dead path -> what it should have been, or null to drop the link. */
const REPLACEMENTS = {
  "/shipping": { id: "returns", label: "Returns & Refunds", href: "/returns" },
  "/size-guide": null,
  "/careers": null,
  // No contact page exists. The footer already carries the contact details and
  // social links from Settings, so this link had nowhere better to point.
  "/contact": null,
  // Guest checkout only: there are no customer accounts to track an order in.
  "/account/orders": null,
};

/** Every policy page should be reachable from the footer. */
const REQUIRED = [
  { id: "returns", label: "Returns & Refunds", href: "/returns" },
  { id: "terms", label: "Terms of Sale", href: "/terms" },
  { id: "privacy", label: "Privacy Notice", href: "/privacy" },
];

async function run() {
  await connectDB();

  const stored = await SiteContent.findOne({ slot: "layout.footer" });
  if (!stored) {
    console.log("The footer has never been edited, so it already uses the corrected defaults.");
    return;
  }

  const data = JSON.parse(JSON.stringify(stored.data));
  const changes = [];

  for (const column of data.columns || []) {
    const kept = [];

    for (const link of column.links || []) {
      if (!(link.href in REPLACEMENTS)) {
        kept.push(link);
        continue;
      }

      const replacement = REPLACEMENTS[link.href];
      if (replacement) {
        kept.push({ ...link, ...replacement });
        changes.push(`${column.title}: ${link.href} -> ${replacement.href}`);
      } else {
        changes.push(`${column.title}: dropped ${link.label} (${link.href} does not exist)`);
      }
    }

    column.links = kept;
  }

  // Add whatever is still missing to the Support column, creating it if the
  // owner has removed it entirely.
  let support = (data.columns || []).find((c) => c.id === "support");
  if (!support) {
    support = { id: "support", title: "Support", links: [] };
    data.columns = [...(data.columns || []), support];
    changes.push("added a Support column");
  }

  for (const required of REQUIRED) {
    const present = (data.columns || []).some((c) =>
      (c.links || []).some((l) => l.href === required.href)
    );
    if (!present) {
      support.links.push(required);
      changes.push(`Support: added ${required.label}`);
    }
  }

  if (changes.length === 0) {
    console.log("No changes — the footer already points only at pages that exist.");
    return;
  }

  stored.data = data;
  stored.markModified("data");
  await stored.save();

  console.log(`Footer updated (${changes.length} change${changes.length === 1 ? "" : "s"}):`);
  changes.forEach((c) => console.log(`  ${c}`));
}

run()
  .catch((err) => {
    console.error(`Failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
