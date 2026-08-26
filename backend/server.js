const path = require("path");
const app = require("./src/app");
const connectDB = require("./src/config/db");
const { startBackupSchedule } = require("./src/utils/backupSchedule");
const { scheduleOrderExpiry } = require("./src/utils/expireOrders");

const PORT = process.env.PORT || 5000;

/**
 * Serves the storefront from this same process when SERVE_FRONTEND is on.
 *
 * One Render service instead of two. The proxy that existed only to keep the
 * auth cookie same-origin becomes unnecessary — one origin makes it true by
 * construction — and CORS stops applying rather than being bypassed.
 *
 * Off by default, so local development keeps the two processes separate and the
 * API can still be deployed on its own.
 */
async function attachFrontend() {
  if (process.env.SERVE_FRONTEND !== "true") return;

  const dir = path.resolve(__dirname, "../frontend");

  /**
   * Server components fetch the API over HTTP even though it is this same
   * process — a loopback call rather than a direct function call. Slightly
   * wasteful, but it keeps lib/api.ts identical in both deployment shapes, and
   * Node serves it asynchronously so it does not block itself.
   *
   * Set before Next prepares, because lib/api.ts reads it at module load.
   */
  process.env.API_ORIGIN = process.env.API_ORIGIN || `http://127.0.0.1:${PORT}`;

  const next = require("next");
  const nextApp = next({ dev: false, dir });

  console.log("Preparing the storefront…");
  await nextApp.prepare();

  app.setFrontendHandler(nextApp.getRequestHandler());
  console.log("Storefront attached — this process serves the shop and the API");
}

connectDB()
  .then(attachFrontend)
  .then(() => {
    const server = app.listen(PORT, () =>
      console.log(
        process.env.SERVE_FRONTEND === "true"
          ? `JULES & CO running on port ${PORT}`
          : `JULES & CO API running on port ${PORT}`
      )
    );

    // Atlas M0 has no automated backups, so the API takes its own. Off unless
    // BACKUP_ENABLED is set, which keeps it from running on a developer machine
    // against the live database.
    startBackupSchedule();
    scheduleOrderExpiry();

    // The API port is deliberately fixed: the frontend and the admin client
    // both address it directly, so falling back to another port would break
    // them quietly. A clear message beats an unhandled listen error, which
    // surfaces as a raw stack trace and reads like an application crash.
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(
          [
            "",
            `Port ${PORT} is already in use — the server cannot start.`,
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
    console.error("Failed to start:", err.message);
    process.exit(1);
  });
