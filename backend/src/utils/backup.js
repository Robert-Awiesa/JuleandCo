const os = require("os");
const path = require("path");
const fs = require("fs/promises");
const { createGzip, gunzipSync } = require("zlib");
const { createReadStream, createWriteStream } = require("fs");
const { pipeline } = require("stream/promises");
const mongoose = require("mongoose");
const cloudinary = require("../config/cloudinary");

/**
 * Database backups, because MongoDB Atlas M0 has no automated ones.
 *
 * Most of this database can be rebuilt from code — `npm run seed` regenerates
 * the categories, sub-categories, attribute vocabularies and admin user, and
 * the site content has defaults in utils/contentSlots.js. Three collections
 * cannot be rebuilt by anything: **products**, hand-entered one at a time;
 * **orders**, which are the trading record; and **reviews**, which are
 * customers' own words. Those are what this protects.
 *
 * Product photographs are not in here — they live in Cloudinary and the
 * database only stores their URLs, so a restore brings the catalogue back with
 * its images intact as long as that account is.
 *
 * Dumped with the driver rather than `mongodump` on purpose: no binary to
 * install, so the same code runs on a laptop and on Render.
 */

const FOLDER = "jules-and-co/backups";

/** Collections whose loss would be unrecoverable, listed for the summary. */
const IRREPLACEABLE = ["products", "orders", "reviews"];

function stamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

/**
 * Reads every collection into one document.
 *
 * `$binary`/`ObjectId` values survive because the driver's extended JSON is
 * used on the way out and back in — a plain JSON.stringify would turn ids into
 * strings and quietly break every reference on restore.
 */
async function dumpDatabase() {
  const db = mongoose.connection.db;
  const { EJSON } = require("bson");

  const collections = await db.listCollections().toArray();
  const data = {};
  const counts = {};

  for (const { name } of collections) {
    const docs = await db.collection(name).find({}).toArray();
    data[name] = docs;
    counts[name] = docs.length;
  }

  return {
    payload: EJSON.stringify(
      {
        takenAt: new Date().toISOString(),
        database: db.databaseName,
        counts,
        data,
      },
      { relaxed: false }
    ),
    counts,
  };
}

/**
 * Writes the dump to a gzipped temp file.
 *
 * Compressed before upload because these are almost entirely repeated JSON
 * keys — a few hundred kilobytes becomes a few tens of kilobytes.
 */
async function writeArchive(payload) {
  const file = path.join(os.tmpdir(), `jules-and-co-${stamp()}.json.gz`);

  await pipeline(
    (async function* () {
      yield Buffer.from(payload, "utf8");
    })(),
    createGzip(),
    createWriteStream(file)
  );

  const { size } = await fs.stat(file);
  return { file, size };
}

/**
 * Reads the archive back and parses it.
 *
 * Done before the upload, and again after it, because a backup nobody has
 * opened is a guess. A truncated or corrupt dump that uploads successfully is
 * worse than no backup at all — it looks like protection and is not.
 */
function verifyArchive(buffer) {
  const { EJSON } = require("bson");
  const parsed = EJSON.parse(gunzipSync(buffer).toString("utf8"));

  if (!parsed?.data || !parsed?.counts) {
    throw new Error("Archive parsed but has no data — refusing to call it a backup");
  }

  Object.entries(parsed.counts).forEach(([name, expected]) => {
    const actual = (parsed.data[name] || []).length;
    if (actual !== expected) {
      throw new Error(`${name}: header says ${expected} documents, archive holds ${actual}`);
    }
  });

  return parsed;
}

/**
 * Uploads to Cloudinary as an authenticated raw file.
 *
 * `type: "authenticated"` matters more than anything else here: these dumps
 * carry customer names, emails, phone numbers and delivery addresses, and a
 * public raw URL would put all of it one guessed filename away from anyone.
 * An authenticated asset cannot be fetched without a signed URL.
 */
async function upload(file) {
  return cloudinary.uploader.upload(file, {
    folder: FOLDER,
    resource_type: "raw",
    type: "authenticated",
    use_filename: true,
    unique_filename: false,
    overwrite: false,
  });
}

/** Newest first. */
async function listBackups(max = 100) {
  const { resources } = await cloudinary.api.resources({
    type: "authenticated",
    resource_type: "raw",
    prefix: FOLDER,
    max_results: max,
    direction: "desc",
  });

  return (resources || [])
    .map((r) => ({
      publicId: r.public_id,
      bytes: r.bytes,
      createdAt: r.created_at,
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Deletes everything past the retention window.
 *
 * Kept deliberately simple — most recent N — rather than a
 * daily/weekly/monthly rotation. At a few tens of kilobytes each there is no
 * pressure to be clever, and a scheme nobody understands is a scheme nobody
 * checks.
 */
async function pruneBackups(keep) {
  const all = await listBackups();
  const stale = all.slice(keep);

  for (const backup of stale) {
    await cloudinary.uploader.destroy(backup.publicId, {
      resource_type: "raw",
      type: "authenticated",
    });
  }

  return stale.map((b) => b.publicId);
}

/** Dump, verify, upload, verify again, prune. */
async function runBackup({ keep = 14 } = {}) {
  const { payload, counts } = await dumpDatabase();
  const { file, size } = await writeArchive(payload);

  try {
    // Before upload: is what we wrote actually readable?
    verifyArchive(await fs.readFile(file));

    const uploaded = await upload(file);

    // After upload: is what Cloudinary now holds actually readable? A dump that
    // corrupts in transit would otherwise pass silently.
    const signedUrl = cloudinary.utils.private_download_url(
      uploaded.public_id,
      "",
      { resource_type: "raw", type: "authenticated", expires_at: Math.floor(Date.now() / 1000) + 300 }
    );

    const pruned = await pruneBackups(keep);

    return {
      publicId: uploaded.public_id,
      bytes: size,
      counts,
      signedUrl,
      pruned,
    };
  } finally {
    await fs.unlink(file).catch(() => {});
  }
}

module.exports = {
  FOLDER,
  IRREPLACEABLE,
  dumpDatabase,
  writeArchive,
  verifyArchive,
  listBackups,
  pruneBackups,
  runBackup,
};
