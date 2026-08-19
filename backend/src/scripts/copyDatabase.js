const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const { MongoClient } = require("mongodb");

// MongoDB cannot rename a database in place, so "renaming" one means copying
// every collection (documents + indexes) into a new database and repointing
// MONGO_URI at it. The source database is left untouched as a rollback point;
// drop it manually once you are satisfied with the copy.
//
//   node src/scripts/copyDatabase.js --from aura-optic --to jules-and-co
//
// Pass --force to write into a target that already holds collections.
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--from") args.from = argv[i + 1];
    if (argv[i] === "--to") args.to = argv[i + 1];
    if (argv[i] === "--force") args.force = true;
  }
  return args;
}

async function copyDatabase() {
  const { from, to, force } = parseArgs(process.argv.slice(2));
  if (!from || !to) throw new Error("Usage: copyDatabase.js --from <db> --to <db> [--force]");
  if (from === to) throw new Error("--from and --to must differ");

  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is not set");

  const client = new MongoClient(uri);
  await client.connect();

  try {
    const source = client.db(from);
    const target = client.db(to);

    const existing = await target.listCollections().toArray();
    if (existing.length > 0 && !force) {
      throw new Error(`Target db "${to}" already has ${existing.length} collection(s). Re-run with --force to write anyway.`);
    }

    const collections = await source.listCollections().toArray();
    if (collections.length === 0) throw new Error(`Source db "${from}" has no collections.`);

    console.log(`Copying ${collections.length} collection(s): ${from} -> ${to}`);

    for (const { name } of collections.sort((a, b) => a.name.localeCompare(b.name))) {
      const docs = await source.collection(name).find({}).toArray();
      if (docs.length > 0) {
        // _id values are carried over verbatim so existing refs (pairsWith,
        // order->user, etc.) keep resolving after the switch.
        await target.collection(name).insertMany(docs, { ordered: false });
      } else {
        await target.createCollection(name).catch(() => {});
      }

      const indexes = await source.collection(name).indexes();
      const custom = indexes.filter((i) => i.name !== "_id_");
      for (const index of custom) {
        const { key, name: indexName, v, ns, background, ...options } = index;
        await target.collection(name).createIndex(key, { name: indexName, ...options });
      }

      console.log(`  ${name.padEnd(16)} ${String(docs.length).padStart(4)} docs, ${custom.length} extra index(es)`);
    }

    console.log("\nVerifying...");
    let ok = true;
    for (const { name } of collections) {
      const before = await source.collection(name).countDocuments();
      const after = await target.collection(name).countDocuments();
      const srcIdx = (await source.collection(name).indexes()).map((i) => i.name).sort();
      const tgtIdx = (await target.collection(name).indexes()).map((i) => i.name).sort();
      const match = before === after && srcIdx.join() === tgtIdx.join();
      if (!match) ok = false;
      console.log(`  ${match ? "OK  " : "FAIL"} ${name.padEnd(16)} ${before} -> ${after} docs, indexes [${tgtIdx.join(", ")}]`);
    }

    console.log(ok
      ? `\nCopy verified. Point MONGO_URI at "${to}"; "${from}" is untouched and can be dropped once you are happy.`
      : "\nMISMATCH — do not repoint MONGO_URI until this is resolved.");
    if (!ok) process.exitCode = 1;
  } finally {
    await client.close();
  }
}

copyDatabase().catch((err) => {
  console.error("Copy failed:", err.message);
  process.exitCode = 1;
});
