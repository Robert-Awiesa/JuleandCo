import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { defineConfig } from "@playwright/test";

// The admin credentials live in backend/.env and are changed there. Loading it
// here keeps the specs working after a password change without duplicating the
// secret into a second file or a CI variable.
dotenv.config({ path: path.resolve(__dirname, "../backend/.env") });

/** Port written by scripts/dev.js; falls back to Next's own default. */
function devServerPort(): string {
  try {
    const recorded = fs.readFileSync(path.resolve(__dirname, ".next-dev-port"), "utf8").trim();
    if (recorded) return recorded;
  } catch {
    // No dev server running, or started some other way.
  }
  return "3000";
}

export default defineConfig({
  testDir: "./e2e",
  // Next dev compiles each route on its first request, which can take well over
  // 30s after a broad code change. That is compile time, not a slow app — a
  // tight timeout here fails the whole suite on a cold server.
  timeout: 90_000,
  // The specs share one fixture product: the create test makes it, later tests
  // publish, unpublish and re-stock it. They must run in order.
  // Assertions get longer than Playwright's 5s default for the same reason the
  // test timeout is raised: on a cold dev server the first hit to a route
  // compiles it, and the admin pages then wait on their own API queries. At 5s
  // a suite that passes on a warm server fails wholesale on a fresh one, which
  // reads as a broken app rather than a slow one.
  expect: { timeout: 15_000 },
  workers: 1,
  fullyParallel: false,
  use: {
    // The dev server takes whatever port is free and records it, so the suite
    // follows it instead of assuming 3000 and failing at the login step with an
    // opaque timeout. An explicit E2E_BASE_URL still wins.
    baseURL: process.env.E2E_BASE_URL || `http://localhost:${devServerPort()}`,
    headless: true,
  },
});
