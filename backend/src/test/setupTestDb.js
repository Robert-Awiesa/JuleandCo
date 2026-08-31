const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongod;

async function connectTestDB() {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);

  /**
   * Wait for every model's indexes to exist before any test runs.
   *
   * Mongoose builds them in the background after connecting, so without this a
   * test can insert before the index is there — and a unique constraint that
   * has not been built yet simply does not apply. That surfaced as the
   * duplicate-slug test intermittently getting 201 instead of 400: not a bug in
   * the code under test, but a race in the harness, which is worse because it
   * sends you looking in the wrong place.
   */
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
}

async function clearTestDB() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

async function closeTestDB() {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongod.stop();
}

module.exports = { connectTestDB, clearTestDB, closeTestDB };
