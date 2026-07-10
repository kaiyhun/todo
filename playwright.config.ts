import { defineConfig, devices } from "@playwright/test";

/**
 * E2E smoke suite (`npm run test:e2e`).
 *
 * Runs against the app in LOCAL_MODE (no login) using the seeded demo data, so
 * `npm run seed` should have been run at least once. Locally it reuses an
 * already-running dev server on :3000; in CI it starts one itself.
 */
export default defineConfig({
  testDir: "./e2e",
  // One shared dev server + database, so run serially for deterministic behavior.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  // Server Actions writing to Atlas can take a couple of seconds — give assertions
  // more headroom than the 5s default.
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/dashboard",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Force auth off so the suite never hits a login wall, regardless of .env.local.
    env: { LOCAL_MODE: "true" },
  },
});
