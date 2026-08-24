const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const https = require("https");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const cloudinary = require("../config/cloudinary");
const { listBackups, verifyArchive } = require("../utils/backup");

/**
 * Restores the database from a Cloudinary backup.
 *
 *   npm run restore -w backend                    # preview the newest backup
 *   npm run restore -w backend -- --id <publicId> # preview a specific one
 *   npm run restore -w backend -- --confirm       # actually write it
 *
 * **Previews by default.** Restoring replaces live collections, and the moment
 * you need this you will be under pressure and unlikely to be careful — so the
 * safe thing has to be what happens when you type the command wrong. Nothing is
 * written without --confirm.
 */
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

/** Authenticated raw assets need a signed URL; a plain fetch would 401. */
function signedUrl(publicId) {
  return cloudinary.utils.private_download_url(publicId, "", {
    resource_type: "raw",
    type: "authenticated",
    expires_at: Math.floor(Date.now() / 1000) + 300,
  });
}

function download(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          return reject(new Error(`Cloudinary returned ${res.statusCode} for the backup`));
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", reject);
  });
}

async function run() {
  await connectDB();

  const backups = await listBackups();
  if (backups.length === 0) {
    console.log("No backups stored. Run `npm run backup -w backend` first.");
    return;
  }

  const wanted = arg("id");
  const chosen = wanted ? backups.find((b) => b.publicId === wanted) : backups[0];

  if (!chosen) {
    console.log(`No backup with id "${wanted}". Available:\n`);
    backups.forEach((b) => console.log(`  ${b.publicId}`));
    process.exitCode = 1;
    return;
  }

  console.log(`Reading ${chosen.publicId} (taken ${chosen.createdAt})…`);

  // Verified before anything is written. A corrupt archive must fail here,
  // while the live data is still intact, not halfway through a restore.
  const archive = verifyArchive(await download(signedUrl(chosen.publicId)));

  const db = mongoose.connection.db;
  const live = {};
  for (const { name } of await db.listCollections().toArray()) {
    live[name] = await db.collection(name).countDocuments();
  }

  console.log(`\nBackup taken at ${archive.takenAt} from database "${archive.database}"\n`);
  console.log("  COLLECTION           IN BACKUP    LIVE NOW   AFTER RESTORE");

  const names = [...new Set([...Object.keys(archive.data), ...Object.keys(live)])].sort();
  names.forEach((name) => {
    const inBackup = (archive.data[name] || []).length;
    const now = live[name] ?? 0;
    // Collections absent from the backup are left alone rather than emptied:
    // a partial restore should not delete something it knows nothing about.
    const after = archive.data[name] ? inBackup : now;
    const changed = after !== now ? "  <-- changes" : "";
    console.log(
      `  ${name.padEnd(20)} ${String(inBackup).padStart(9)} ${String(now).padStart(11)} ${String(after).padStart(15)}${changed}`
    );
  });

  if (!process.argv.includes("--confirm")) {
    console.log(
      "\nPreview only — nothing has been written.\n" +
        "Re-run with --confirm to replace the collections listed above."
    );
    return;
  }

  console.log("\nRestoring…");

  for (const [name, docs] of Object.entries(archive.data)) {
    const collection = db.collection(name);
    await collection.deleteMany({});
    if (docs.length > 0) {
      await collection.insertMany(docs);
    }
    console.log(`  ${name.padEnd(20)} ${String(docs.length).padStart(5)} restored`);
  }

  console.log(
    "\nDone. Indexes are rebuilt by Mongoose on next boot, so restart the API.\n" +
      "Check the admin before serving customers."
  );
}

run()
  .catch((err) => {
    console.error("\nRestore failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
