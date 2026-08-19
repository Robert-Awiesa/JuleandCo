import { defineConfig } from "@playwright/test";

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
    baseURL: "http://localhost:3000",
    headless: true,
  },
});
