import path from "path";
import dotenv from "dotenv";
import { defineConfig } from "@playwright/test";

// The admin credentials live in backend/.env and are changed there. Loading it
// here keeps the specs working after a password change without duplicating the
// secret into a second file or a CI variable.
dotenv.config({ path: path.resolve(__dirname, "../backend/.env") });

export default defineConfig({
  testDir: "./e2e",
  // Next dev compiles each route on its first request, which can take well over
  // 30s after a broad code change. That is compile time, not a slow app — a
  // tight timeout here fails the whole suite on a cold server.
  timeout: 90_000,
  // The specs share one fixture product: the create test makes it, later tests
  // publish, unpublish and re-stock it. They must run in order.
  workers: 1,
  fullyParallel: false,
  use: {
    // Next falls back to 3001 (and up) whenever 3000 is occupied, which made
    // the whole suite fail at the login step with an opaque timeout.
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    headless: true,
  },
});
