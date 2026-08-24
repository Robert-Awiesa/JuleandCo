const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const { runBackup, listBackups, IRREPLACEABLE } = require("../utils/backup");

/**
 * Takes a backup and puts it in Cloudinary.
 *
 *   npm run backup -w backend            # take one, keep the last 14
 *   npm run backup -w backend -- --keep 30
 *   npm run backup -w backend -- --list  # show what is stored
 *
 * Atlas M0 has no automated backups, and three collections here cannot be
 * rebuilt by anything: products are hand-entered, orders are the trading
 * record, and reviews are customers' own words. Everything else regenerates
 * with `npm run seed`.
 */
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

async function run() {
  await connectDB();

  if (process.argv.includes("--list")) {
    const backups = await listBackups();
    if (backups.length === 0) {
      console.log("No backups stored yet.");
      return;
    }
    console.log(`${backups.length} backup(s), newest first:\n`);
    backups.forEach((b) =>
      console.log(`  ${b.createdAt}  ${kb(b.bytes).padStart(10)}  ${b.publicId}`)
    );
    return;
  }

  const keep = Math.max(1, Number(arg("keep", 14)));

  console.log("Backing up…");
  const result = await runBackup({ keep });

  console.log(`\nStored as ${result.publicId} (${kb(result.bytes)} compressed)\n`);

  Object.entries(result.counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([name, n]) => {
      // The three that matter are called out: everything else is reproducible.
      const mark = IRREPLACEABLE.includes(name) ? " ←" : "";
      console.log(`  ${name.padEnd(18)} ${String(n).padStart(5)}${mark}`);
    });

  console.log("\n  ← cannot be rebuilt from code. This is what the backup is for.");

  if (result.pruned.length > 0) {
    console.log(`\nRemoved ${result.pruned.length} backup(s) older than the last ${keep}.`);
  }

  console.log(
    "\nStored as an authenticated Cloudinary asset — it holds customer names,\n" +
      "emails, phone numbers and addresses, so it is not publicly fetchable."
  );
}

run()
  .catch((err) => {
    console.error("\nBackup failed:", err.message);
    // Non-zero so a scheduler notices. A backup that fails quietly is the worst
    // possible outcome: you find out only when you need to restore.
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
