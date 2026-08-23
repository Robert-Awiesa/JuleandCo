const app = require("./src/app");
const connectDB = require("./src/config/db");

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    const server = app.listen(PORT, () =>
      console.log(`JULES & CO API running on port ${PORT}`)
    );

    // The API port is deliberately fixed: the frontend and the admin client
    // both address it directly, so falling back to another port would break
    // them quietly. A clear message beats an unhandled listen error, which
    // surfaces as a raw stack trace and reads like an application crash.
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(
          [
            "",
            `Port ${PORT} is already in use — the API cannot start.`,
            "Something else is bound to it, most likely another copy of this server.",
            `Free it with:  npx kill-port ${PORT}`,
            "",
          ].join("\n")
        );
        process.exit(1);
      }
      throw err;
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });
