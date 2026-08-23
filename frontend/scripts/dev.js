#!/usr/bin/env node
/**
 * Starts the Next dev server on port 3000, and only 3000.
 *
 * This briefly picked a free port instead, which fixed the crash but made the
 * address change on every restart — bookmarks, the Playwright base URL and the
 * API's CORS origin all had to chase it, which is worse than the problem.
 *
 * Next's own behaviour is the actual hazard: when 3000 is busy it drifts to
 * 3001 with a one-line notice, and two dev servers then share one .next
 * directory and clobber each other's chunks — which surfaces much later as a
 * ChunkLoadError on a page that was working. So the port is checked first and a
 * clash is reported plainly rather than worked around.
 */
const net = require("net");
const { spawn } = require("child_process");

const PORT = Number(process.env.PORT) || 3000;

/** Resolves true when nothing else is listening on the port. */
function isFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "0.0.0.0");
  });
}

(async () => {
  if (!(await isFree(PORT))) {
    console.error(
      `\n  Port ${PORT} is already in use.\n\n` +
        `  Another dev server is probably still running — stop it and try again.\n` +
        `  Next would otherwise move to ${PORT + 1}, and two servers sharing one\n` +
        `  .next directory corrupt each other's build output.\n\n` +
        `  To find it:  netstat -ano | findstr :${PORT}\n` +
        `  Or run on a different port:  PORT=3005 npm run dev -w frontend\n`
    );
    process.exit(1);
  }

  const nextBin = require.resolve("next/dist/bin/next");
  const child = spawn(process.execPath, [nextBin, "dev", "-p", String(PORT)], {
    stdio: "inherit",
  });

  const stop = (signal) => {
    if (!child.killed) child.kill(signal);
  };

  process.on("SIGINT", () => stop("SIGINT"));
  process.on("SIGTERM", () => stop("SIGTERM"));

  child.on("exit", (code) => process.exit(code ?? 0));
})().catch((err) => {
  console.error("Could not start the dev server:", err.message);
  process.exit(1);
});
