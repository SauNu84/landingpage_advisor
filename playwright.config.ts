// playwright.config.ts
// NOTE: @playwright/test is NOT yet installed in this project.
// To install: npm install --save-dev @playwright/test
// To run tests: npx playwright test
// The dev server must be started manually before running: npm run dev

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".qc-artifacts/scripts",
  testMatch: "**/*.e2e-ui.gen.spec.ts",
  /* Run tests in parallel */
  fullyParallel: true,
  /* Fail the build on CI if test.only is left in source */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* One worker on CI */
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["list"],
    [
      "json",
      { outputFile: ".qc-artifacts/results/playwright-results.json" },
    ],
  ],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // NOTE: webServer is intentionally omitted — start the dev server manually
  // with `npm run dev` before executing Playwright tests.
  // webServer: {
  //   command: "npm run dev",
  //   url: "http://localhost:3000",
  //   reuseExistingServer: !process.env.CI,
  // },
});
