const mongoose = require("mongoose");

/**
 * Connects to MongoDB, once per process, however many times it is called.
 *
 * On a long-lived server this ran exactly once at boot and the cache was
 * irrelevant. On Vercel it is the difference between working and falling over:
 * every serverless invocation may be a cold start, `mongoose.connect()` opens a
 * new connection each time, and Atlas caps how many it will hold — M0 at 500.
 * Under any real traffic the pool fills with connections nobody is using and
 * new requests are refused.
 *
 * The promise is cached on `globalThis` rather than in module scope because a
 * platform may re-evaluate the module while reusing the process, which would
 * quietly reset a module-level variable and reintroduce the leak.
 */
const CACHE_KEY = "__julesAndCoMongoose";

function cache() {
  if (!globalThis[CACHE_KEY]) {
    globalThis[CACHE_KEY] = { connection: null, promise: null };
  }
  return globalThis[CACHE_KEY];
}

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI is not set — add it to backend/.env (see README § Getting Started)");
  }

  const cached = cache();
  if (cached.connection) return cached.connection;

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri, {
        // Fail fast rather than holding a serverless invocation open for the
        // default 30 seconds while it waits for a server it cannot reach.
        serverSelectionTimeoutMS: 10000,
        // Keep the pool small: many short-lived instances each holding a large
        // pool is exactly how an Atlas connection limit is reached.
        maxPoolSize: 10,
      })
      .then((conn) => {
        console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
        return conn;
      })
      .catch((err) => {
        // Clear the cached promise so the next request retries rather than
        // rejecting forever with the first failure.
        cached.promise = null;
        throw err;
      });
  }

  cached.connection = await cached.promise;
  return cached.connection;
}

module.exports = connectDB;
