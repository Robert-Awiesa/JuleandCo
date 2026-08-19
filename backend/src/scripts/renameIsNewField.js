const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Product = require("../models/Product");

// One-time migration: `isNew` collided with Mongoose's built-in Document.isNew
// flag, which triggers a reserved-schema-pathname warning and shadows the real
// property. The schema path is now `isNewArrival`; this renames it on documents
// that were written before the change.
async function renameIsNewField() {
  await connectDB();

  const collection = Product.collection;
  const pending = await collection.countDocuments({ isNew: { $exists: true } });

  if (pending === 0) {
    console.log("Nothing to migrate — no products still carry `isNew`.");
    return;
  }

  console.log(`Renaming \`isNew\` -> \`isNewArrival\` on ${pending} product(s)...`);

  // Documents that somehow have both keep the already-migrated value; $rename
  // would fail on a conflict, so drop the stale key for those first.
  const bothKeys = await collection.updateMany(
    { isNew: { $exists: true }, isNewArrival: { $exists: true } },
    { $unset: { isNew: "" } }
  );
  if (bothKeys.modifiedCount > 0) {
    console.log(`  dropped stale \`isNew\` on ${bothKeys.modifiedCount} doc(s) that already had \`isNewArrival\``);
  }

  const renamed = await collection.updateMany(
    { isNew: { $exists: true } },
    { $rename: { isNew: "isNewArrival" } }
  );
  console.log(`  renamed on ${renamed.modifiedCount} doc(s)`);

  const remaining = await collection.countDocuments({ isNew: { $exists: true } });
  console.log(remaining === 0 ? "Migration complete." : `WARNING: ${remaining} doc(s) still have \`isNew\`.`);
}

renameIsNewField()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
