#!/usr/bin/env node
/**
 * Starts the Next dev server on whatever port the machine has free.
 *
 * A fixed port meant a stale server, a second terminal, or an unrelated project
 * holding 3000 produced either an EADDRINUSE crash or a silent fallback to 3001
 * — and two Next servers sharing one .next directory clobber each other's
 * chunks, which shows up later as a ChunkLoadError on a page that was fine.
 *
 * The port is chosen here rather than by passing `-p 0` so it can be written to
 * .next-dev-port for anything that needs to find the server afterwards, notably
 * Playwright. The file is removed on exit so a stale value never misleads.
 */
const net = require("net");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const PORT_FILE = path.resolve(__dirname, "..", ".next-dev-port");

/** Ask the OS for a free port by binding to 0 and reading back what we got. */
function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "0.0.0.0", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function cleanup() {
  try {
    fs.unlinkSync(PORT_FILE);
  } catch {
    // Already gone, or never written — nothing to do.
  }
}

(async () => {
  // PORT still wins when set, so a deploy or a deliberate choice is respected.
  const port = process.env.PORT ? Number(process.env.PORT) : await findFreePort();

  fs.writeFileSync(PORT_FILE, String(port));
  console.log(`\n  Dev server port: ${port}  (also written to frontend/.next-dev-port)\n`);

  const nextBin = require.resolve("next/dist/bin/next");
  const child = spawn(process.execPath, [nextBin, "dev", "-p", String(port)], {
    stdio: "inherit",
  });

  const stop = (signal) => {
    cleanup();
    if (!child.killed) child.kill(signal);
  };

  process.on("SIGINT", () => stop("SIGINT"));
  process.on("SIGTERM", () => stop("SIGTERM"));
  process.on("exit", cleanup);

  child.on("exit", (code) => {
    cleanup();
    process.exit(code ?? 0);
  });
})().catch((err) => {
  console.error("Could not start the dev server:", err.message);
  cleanup();
  process.exit(1);
});
