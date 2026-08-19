const mongoose = require("mongoose");

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI is not set — add it to backend/.env (see README § Getting Started)");
  }
  const conn = await mongoose.connect(uri);
  console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
}

module.exports = connectDB;
